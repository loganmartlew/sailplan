import { and, asc, eq, inArray } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import {
  captureSample,
  captureSession,
  courseMark,
  mark,
  sailedLeg,
  sailSpan,
  sailStamp,
} from '~/schema';
import { proposeDraftAttribution } from '../util/draftAttribution';
import { detectSailedLegs } from '../util/sailedLegDetection';
import type { EditableSailSpan } from '../util/spanEditing';
import { sailSpanInsertsFor } from '../util/spanPersistence';

export function useSailedLegReview(sessionId: number) {
  const session = useLiveQuery(
    db.query.captureSession.findFirst({
      where: eq(captureSession.id, sessionId),
    }),
    [sessionId],
  );
  const legs = useLiveQuery(
    db.query.sailedLeg.findMany({
      where: eq(sailedLeg.captureSessionId, sessionId),
      orderBy: [asc(sailedLeg.startTime)],
      with: { sailSpans: true },
    }),
    [sessionId],
  );
  const samples = useLiveQuery(
    db.query.captureSample.findMany({
      where: eq(captureSample.captureSessionId, sessionId),
      orderBy: [asc(captureSample.timestamp)],
    }),
    [sessionId],
  );
  const courseMarks = useLiveQuery(
    db
      .select({
        id: courseMark.id,
        order: courseMark.order,
        name: mark.name,
        latitude: mark.latitude,
        longitude: mark.longitude,
      })
      .from(courseMark)
      .innerJoin(mark, eq(mark.id, courseMark.markId))
      .where(eq(courseMark.courseId, session.data?.courseId ?? -1))
      // `(order, id)`: a course whose orders are all equal — every course built
      // before the `courseMark.order` backfill — must still come out in
      // insertion order rather than by SQLite's tiebreak.
      .orderBy(asc(courseMark.order), asc(courseMark.id)),
    [session.data?.courseId],
  );
  return { legs, samples, courseMarks };
}

type ReviewTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Detect this session's legs and their draft sail spans, and store them.
 *
 * The transaction is the caller's: materialising for the first time and
 * re-detecting differ only in what they clear first, and both have to leave the
 * session's stored review consistent with `reviewMaterializedAt` or not happen
 * at all.
 */
function buildCaptureReview(
  tx: ReviewTransaction,
  sessionId: number,
  courseId: number | null,
): void {
  const samples = tx
    .select()
    .from(captureSample)
    .where(eq(captureSample.captureSessionId, sessionId))
    .orderBy(asc(captureSample.timestamp))
    .all();
  const courseMarks = courseId === null
    ? []
    : tx
        .select({
          id: courseMark.id,
          name: mark.name,
          latitude: mark.latitude,
          longitude: mark.longitude,
        })
        .from(courseMark)
        .innerJoin(mark, eq(mark.id, courseMark.markId))
        .where(eq(courseMark.courseId, courseId))
        .orderBy(asc(courseMark.order), asc(courseMark.id))
        .all();
  const stamps = tx
    .select({ timestamp: sailStamp.timestamp, sailId: sailStamp.sailId })
    .from(sailStamp)
    .where(eq(sailStamp.captureSessionId, sessionId))
    .orderBy(asc(sailStamp.timestamp))
    .all();

  const detectedLegs = proposeDraftAttribution(
    samples,
    detectSailedLegs(samples, courseMarks),
    stamps,
  );
  for (const detected of detectedLegs) {
    const row = tx
      .insert(sailedLeg)
      .values({
        captureSessionId: sessionId,
        ordinal: detected.ordinal,
        startTime: detected.startTime,
        endTime: detected.endTime,
        name: detected.name,
        courseMarkId: detected.courseMarkId,
        confirmedAt: null,
      })
      .returning({ id: sailedLeg.id })
      .get();
    tx.insert(sailSpan)
      .values(detected.draftSpans.map(span => ({ ...span, sailedLegId: row.id })))
      .run();
  }
}

/**
 * Materialise claims once. Later opens always read the stored legs and spans.
 *
 * Returns `false` when the session is gone. A review screen can be mounted
 * while its session is deleted from elsewhere, so a missing row is an ordinary
 * outcome to render, not an exception — and this runs from an effect, where a
 * throw escapes uncaught and takes the app down.
 */
export function materializeCaptureReview(sessionId: number): boolean {
  let found = true;
  db.transaction(tx => {
    const session = tx
      .select()
      .from(captureSession)
      .where(eq(captureSession.id, sessionId))
      .get();
    if (!session) {
      found = false;
      return;
    }
    if (session.reviewMaterializedAt !== null) return;
    buildCaptureReview(tx, sessionId, session.courseId);
    tx.update(captureSession)
      .set({ reviewMaterializedAt: Date.now() })
      .where(eq(captureSession.id, sessionId))
      .run();
  });
  return found;
}

/**
 * Throw away this session's stored legs and spans and detect them again.
 *
 * Materialisation happens once, so without this a fix to leg detection can
 * never reach a session that already exists on the phone — including the race
 * that motivated the fix. Everything the review holds is rebuilt: the legs, the
 * draft sail spans, and the sailor's confirmations along with them, because a
 * confirmation is a judgement about *these* boundaries and cannot be carried
 * onto boundaries somewhere else. The caller warns before that is discarded.
 */
export function redetectCaptureReview(sessionId: number): boolean {
  let found = true;
  db.transaction(tx => {
    const session = tx
      .select()
      .from(captureSession)
      .where(eq(captureSession.id, sessionId))
      .get();
    if (!session) {
      found = false;
      return;
    }
    const legIds = tx
      .select({ id: sailedLeg.id })
      .from(sailedLeg)
      .where(eq(sailedLeg.captureSessionId, sessionId))
      .all()
      .map(row => row.id);
    if (legIds.length > 0) {
      tx.delete(sailSpan).where(inArray(sailSpan.sailedLegId, legIds)).run();
      tx.delete(sailedLeg).where(eq(sailedLeg.captureSessionId, sessionId)).run();
    }
    buildCaptureReview(tx, sessionId, session.courseId);
    tx.update(captureSession)
      .set({ reviewMaterializedAt: Date.now() })
      .where(eq(captureSession.id, sessionId))
      .run();
  });
  return found;
}

export function confirmSailedLegPresentation({
  parts,
  name,
  used,
  confirmedAt = Date.now(),
}: {
  parts: readonly {
    legId: number;
    spans: readonly EditableSailSpan[];
  }[];
  name: string;
  used: boolean;
  confirmedAt?: number;
}): void {
  if (parts.length === 0) return;
  db.transaction(tx => {
    const current = tx
      .select({
        captureSessionId: sailedLeg.captureSessionId,
        ordinal: sailedLeg.ordinal,
      })
      .from(sailedLeg)
      .where(eq(sailedLeg.id, parts[0].legId))
      .get();
    if (!current) throw new Error('Sailed leg not found');
    for (const part of parts) {
      tx.delete(sailSpan).where(eq(sailSpan.sailedLegId, part.legId)).run();
      const rows = sailSpanInsertsFor({
        sailedLegId: part.legId,
        spans: part.spans,
      });
      if (rows.length > 0) tx.insert(sailSpan).values(rows).run();
      tx.update(sailedLeg)
        .set({ confirmedAt, used })
        .where(eq(sailedLeg.id, part.legId))
        .run();
    }
    // A dropout continuation is stored separately but presented as the same
    // leg. Renaming either stored part updates the shared presentation.
    tx.update(sailedLeg)
      .set({ name: name.trim() })
      .where(and(
        eq(sailedLeg.captureSessionId, current.captureSessionId),
        eq(sailedLeg.ordinal, current.ordinal),
      ))
      .run();
  });
}
