import { useMemo } from 'react';
import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  max,
  min,
  ne,
  sql,
} from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { CaptureSession } from '~/features/capture/model/capture';
import { summarizeCaptureSessions } from '~/features/capture/model/captureSessionSummary';
import type {
  CaptureHealth,
  ReplayCaptureSample,
  WindFrame,
} from '~/features/capture/util/replayCaptureSession';
import { db } from '~/lib/db';
import { captureSample, captureSession, connectionEvent, sailedLeg } from '~/schema';

export function useCaptureSessionSummaries(boatProfileId: number | null) {
  const activeBoatProfileId = boatProfileId ?? -1;
  const query = useLiveQuery(
    db
      .select({
        session: captureSession,
        sampleCount: count(captureSample.id),
        usableSampleCount: sql<number>`sum(case when ${captureSample.tws} is not null and ${captureSample.twa} is not null and ${captureSample.stw} is not null and ${captureSample.hdg} is not null then 1 else 0 end)`.mapWith(Number),
        minTws: min(captureSample.tws),
        maxTws: max(captureSample.tws),
      })
      .from(captureSession)
      .leftJoin(
        captureSample,
        eq(captureSample.captureSessionId, captureSession.id),
      )
      .where(
        and(
          eq(captureSession.boatProfileId, activeBoatProfileId),
          ne(captureSession.status, 'active'),
        ),
      )
      .groupBy(captureSession.id)
      .orderBy(desc(captureSession.startedAt)),
    [activeBoatProfileId],
  );

  const data = useMemo(
    () => summarizeCaptureSessions(query.data),
    [query.data],
  );

  return { ...query, data };
}

export async function createActiveCaptureSession({
  boatProfileId,
  courseId,
  startedAt,
}: {
  boatProfileId: number;
  courseId: number;
  startedAt: number;
}): Promise<CaptureSession> {
  return db.transaction(tx => {
    // A successful newer recording permanently consumes every older resume
    // offer for this boat. Keep this in the creation transaction so a failed
    // insert cannot dismiss an offer without actually starting anything.
    tx.update(captureSession)
      .set({ resumeDismissedAt: startedAt })
      .where(
        and(
          eq(captureSession.boatProfileId, boatProfileId),
          eq(captureSession.status, 'autoEnded'),
          isNull(captureSession.resumeDismissedAt),
          lt(captureSession.startedAt, startedAt),
        ),
      )
      .run();

    return tx
      .insert(captureSession)
      .values({
        boatProfileId,
        courseId,
        startedAt,
        name: `Recording ${new Date(startedAt).toLocaleString()}`,
        status: 'active',
        endedAt: null,
        resumeDismissedAt: null,
        rawLogPath: null,
        windFrame: null,
        reviewMaterializedAt: null,
        healthCounters: '{}',
        notes: '',
      })
      .returning()
      .get();
  });
}

export async function setCaptureSessionRawLogPath(
  sessionId: number,
  rawLogPath: string,
): Promise<void> {
  await db
    .update(captureSession)
    .set({ rawLogPath })
    .where(eq(captureSession.id, sessionId));
}

/**
 * Persists a parser emission and its cumulative health in one SQLite
 * transaction. The socket callback queues these calls, so every emitted row is
 * written in order without waiting on React or a timer.
 */
export async function persistCaptureBatch(
  sessionId: number,
  samples: readonly ReplayCaptureSample[],
  health: CaptureHealth,
  windFrame: WindFrame,
): Promise<void> {
  db.transaction(tx => {
    if (samples.length > 0) {
      tx.insert(captureSample)
        .values(samples.map(sample => ({ ...sample, captureSessionId: sessionId })))
        .run();
    }
    tx.update(captureSession)
      .set({ healthCounters: JSON.stringify(health), windFrame })
      .where(eq(captureSession.id, sessionId))
      .run();
  });
}

export async function endCaptureSession(
  sessionId: number,
  endedAt: number,
): Promise<void> {
  await db
    .update(captureSession)
    .set({ status: 'ended', endedAt })
    .where(eq(captureSession.id, sessionId));
}

export async function autoEndCaptureSession(
  sessionId: number,
  endedAt: number,
): Promise<void> {
  await db
    .update(captureSession)
    .set({ status: 'autoEnded', endedAt })
    .where(eq(captureSession.id, sessionId));
}

export async function reopenCaptureSession(sessionId: number): Promise<void> {
  const reopened = await db
    .update(captureSession)
    .set({ status: 'active', endedAt: null })
    .where(
      and(
        eq(captureSession.id, sessionId),
        eq(captureSession.status, 'autoEnded'),
        isNull(captureSession.resumeDismissedAt),
      ),
    )
    .returning({ id: captureSession.id });
  if (reopened.length === 0) {
    throw new Error('Capture session is no longer resumable');
  }
}

export async function addConnectionEvent(
  captureSessionId: number,
  at: number,
  kind: 'lost' | 'recovered',
): Promise<void> {
  await db.insert(connectionEvent).values({ captureSessionId, at, kind });
}

export async function dismissCaptureResume(
  sessionId: number,
  dismissedAt: number = Date.now(),
): Promise<void> {
  await db
    .update(captureSession)
    .set({ resumeDismissedAt: dismissedAt })
    .where(eq(captureSession.id, sessionId));
}

export async function getCaptureResumeFacts(session: CaptureSession): Promise<{
  hasLaterSession: boolean;
  hasReviewedData: boolean;
}> {
  const [later, reviewed] = await Promise.all([
    db.query.captureSession.findFirst({
      where: eq(captureSession.boatProfileId, session.boatProfileId),
      orderBy: (row, { desc }) => [desc(row.startedAt)],
    }),
    db.query.sailedLeg.findFirst({
      where: and(
        eq(sailedLeg.captureSessionId, session.id),
        isNotNull(sailedLeg.reviewedAt),
      ),
    }),
  ]);
  return {
    hasLaterSession: Boolean(later && later.startedAt > session.startedAt),
    hasReviewedData: Boolean(reviewed),
  };
}

export async function deleteCaptureSession(sessionId: number): Promise<void> {
  await db.delete(captureSession).where(eq(captureSession.id, sessionId));
}
