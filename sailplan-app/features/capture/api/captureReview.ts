import { and, asc, eq, inArray } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { db } from '~/lib/db';
import {
  captureSample,
  captureSession,
  course,
  courseMark,
  mark,
  sailedLeg,
  sailSpan,
  sailStamp,
} from '~/schema';
import { proposeDraftAttribution } from '../util/draftAttribution';
import {
  groupSailedLegParts,
  summarizeSailedLegs,
  type SailedLegSummary,
} from '../util/legReview';
import { detectSailedLegs } from '../util/sailedLegDetection';
import { findSteadyStretches, type SteadyStretch } from '../util/steadyState';
import type { EditableSailSpan } from '../util/spanEditing';
import { sailedLegDraftChanged } from '../util/legReview';
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
  return { session, legs, samples, courseMarks };
}

/**
 * The course this session recorded, if one was linked.
 *
 * The session's own `name` is machine-made — `Recording 15/08/2026, 12:36:50 pm`
 * — so spending the screen's largest type on it says nothing a sailor would use
 * to recognise the race. The course is what they would call it.
 */
export function useCaptureSessionCourseName(sessionId: number): string | null {
  const session = useLiveQuery(
    db.query.captureSession.findFirst({
      where: eq(captureSession.id, sessionId),
    }),
    [sessionId],
  );
  const linkedCourse = useLiveQuery(
    db.query.course.findFirst({
      where: eq(course.id, session.data?.courseId ?? -1),
    }),
    [session.data?.courseId],
  );
  return linkedCourse.data?.name ?? null;
}

/**
 * The session's steadiness mask, computed once and held.
 *
 * It is a synchronous pass over every sample of a multi-hour recording, and
 * both review screens want it — the list to say what each leg yields, the leg
 * screen to light the stretches on the trace. A completed session's samples
 * never change, so recomputing it per screen would only spend the same second
 * twice. One entry: the sailor reviews one session at a time.
 */
let cachedMask: { sessionId: number; sampleCount: number; mask: SteadyStretch[] } | null = null;

function captureSteadyMask(
  sessionId: number,
  samples: readonly Parameters<typeof findSteadyStretches>[0][number][],
): SteadyStretch[] {
  if (cachedMask?.sessionId === sessionId && cachedMask.sampleCount === samples.length) {
    return cachedMask.mask;
  }
  const mask = findSteadyStretches(samples);
  cachedMask = { sessionId, sampleCount: samples.length, mask };
  return mask;
}

export type CaptureReviewState = 'preparing' | 'ready' | 'sessionMissing';

/**
 * Everything both review screens read: the stored legs grouped as the sailor
 * sees them, what each yields, and the session's own facts.
 *
 * Materialisation is idempotent, so both the list and a deep-linked leg can ask
 * for it; whichever arrives first does the work. It is deferred off the entry
 * animation because leg detection and draft attribution run synchronously
 * inside a SQLite transaction, and a multi-hour session is a lot of samples.
 */
export function useCaptureReview(sessionId: number) {
  const { session, legs, samples, courseMarks } = useSailedLegReview(sessionId);
  const [prepared, setPrepared] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);

  useEffect(() => {
    setPrepared(false);
    setSessionMissing(false);
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setSessionMissing(!materializeCaptureReview(sessionId));
      setPrepared(true);
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [sessionId]);

  const loaded =
    prepared
    && legs.updatedAt !== undefined
    && samples.updatedAt !== undefined
    && courseMarks.updatedAt !== undefined;

  const mask = useMemo(
    () => (loaded ? captureSteadyMask(sessionId, samples.data) : []),
    [loaded, sessionId, samples.data],
  );
  const presentations = useMemo(
    () => groupSailedLegParts(legs.data),
    [legs.data],
  );
  const summaries = useMemo(
    () => (loaded
      ? summarizeSailedLegs({ legs: legs.data, mask, samples: samples.data })
      : []),
    [loaded, legs.data, mask, samples.data],
  );

  const state: CaptureReviewState = sessionMissing
    ? 'sessionMissing'
    : loaded ? 'ready' : 'preparing';

  return {
    state,
    session,
    legs,
    samples,
    courseMarks,
    mask,
    presentations,
    summaries,
  };
}

export type { SailedLegSummary };

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
        reviewedAt: null,
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
 * draft sail spans, and the sailor's own edits along with them, because an edit
 * is a judgement about *these* boundaries and cannot be carried onto boundaries
 * somewhere else. The caller warns before that is discarded.
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

/**
 * Store what the sailor has on screen for one leg: its spans, its name, and
 * whether it is used. Nothing else.
 *
 * This is the whole of what leaving a leg does. It replaced a confirm, which
 * was doing two unrelated jobs at once — recording that the sailor had worked
 * here, and clearing the data for the polar. The second belongs to promotion,
 * which is one deliberate decision for the whole session; welding it to a Next
 * button meant the only way to record work was to move forward past it, so a
 * review could not be paused or wandered through without losing edits.
 *
 * `reviewedAt` is set only when the save actually **changes** something. A leg
 * the sailor merely opened has no hand work to lose, and marking it reviewed
 * would both let its draft attribution into the polar and make the re-detect
 * warning cry wolf.
 */
export function saveSailedLegDraft({
  parts,
  name,
  used,
  reviewedAt = Date.now(),
}: {
  parts: readonly {
    legId: number;
    spans: readonly EditableSailSpan[];
  }[];
  name: string;
  used: boolean;
  reviewedAt?: number;
}): void {
  if (parts.length === 0) return;
  db.transaction(tx => {
    const current = tx
      .select()
      .from(sailedLeg)
      .where(eq(sailedLeg.id, parts[0].legId))
      .get();
    if (!current) throw new Error('Sailed leg not found');

    const legIds = parts.map(part => part.legId);
    const storedSpans = tx
      .select({
        sailedLegId: sailSpan.sailedLegId,
        startTime: sailSpan.startTime,
        endTime: sailSpan.endTime,
        sailId: sailSpan.sailId,
      })
      .from(sailSpan)
      .where(inArray(sailSpan.sailedLegId, legIds))
      .orderBy(asc(sailSpan.startTime))
      .all();
    const nextRows = parts.flatMap(part =>
      sailSpanInsertsFor({ sailedLegId: part.legId, spans: part.spans }),
    );
    const changed = sailedLegDraftChanged(
      {
        ordinal: current.ordinal,
        name: current.name,
        used: current.used,
        spans: storedSpans,
      },
      {
        name,
        used,
        spans: nextRows.map(row => ({
          startTime: row.startTime,
          endTime: row.endTime,
          sailId: row.sailId ?? null,
        })),
      },
    );

    for (const part of parts) {
      tx.delete(sailSpan).where(eq(sailSpan.sailedLegId, part.legId)).run();
      const rows = nextRows.filter(row => row.sailedLegId === part.legId);
      if (rows.length > 0) tx.insert(sailSpan).values(rows).run();
      tx.update(sailedLeg)
        .set(changed ? { reviewedAt, used } : { used })
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
