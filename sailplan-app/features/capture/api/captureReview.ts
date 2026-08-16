import { and, asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '~/lib/db';
import {
  captureSample,
  captureSession,
  courseMark,
  mark,
  sailedLeg,
  sailSpan,
} from '~/schema';
import type { SailSpan } from '../model/capture';
import { detectSailedLegs } from '../util/sailedLegDetection';

export function useSailedLegReview(sessionId: number) {
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
  return { legs, samples };
}

/** Materialise claims once. Later opens always read the stored legs and spans. */
export function materializeCaptureReview(sessionId: number): void {
  db.transaction(tx => {
    const session = tx
      .select()
      .from(captureSession)
      .where(eq(captureSession.id, sessionId))
      .get();
    if (!session) throw new Error('Capture session not found');
    if (session.reviewMaterializedAt !== null) return;
    const samples = tx
      .select()
      .from(captureSample)
      .where(eq(captureSample.captureSessionId, sessionId))
      .orderBy(asc(captureSample.timestamp))
      .all();
    const courseMarks = session.courseId === null
      ? []
      : tx
          .select({ id: courseMark.id, name: mark.name })
          .from(courseMark)
          .innerJoin(mark, eq(mark.id, courseMark.markId))
          .where(eq(courseMark.courseId, session.courseId))
          .orderBy(asc(courseMark.order))
          .all();

    for (const detected of detectSailedLegs(samples, courseMarks)) {
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
    tx.update(captureSession)
      .set({ reviewMaterializedAt: Date.now() })
      .where(eq(captureSession.id, sessionId))
      .run();
  });
}

export function confirmSailedLegPresentation({
  parts,
  name,
  used,
  confirmedAt = Date.now(),
}: {
  parts: readonly {
    legId: number;
    spans: readonly Pick<SailSpan, 'startTime' | 'endTime' | 'sailId'>[];
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
      if (used && part.spans.length > 0) {
        tx.insert(sailSpan)
          .values(part.spans.map(span => ({ ...span, sailedLegId: part.legId })))
          .run();
      }
      tx.update(sailedLeg)
        .set({ confirmedAt })
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
