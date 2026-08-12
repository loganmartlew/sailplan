import { eq } from 'drizzle-orm';
import type { CaptureSession } from '~/features/capture/model/capture';
import type {
  CaptureHealth,
  ReplayCaptureSample,
  WindFrame,
} from '~/features/capture/util/replayCaptureSession';
import { db } from '~/lib/db';
import { captureSample, captureSession } from '~/schema';

export async function createActiveCaptureSession({
  boatProfileId,
  courseId,
  startedAt,
}: {
  boatProfileId: number;
  courseId: number;
  startedAt: number;
}): Promise<CaptureSession> {
  const created = await db
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
      healthCounters: '{}',
      notes: '',
    })
    .returning();

  return created[0];
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

export async function deleteCaptureSession(sessionId: number): Promise<void> {
  await db.delete(captureSession).where(eq(captureSession.id, sessionId));
}
