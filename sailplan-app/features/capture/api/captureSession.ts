import { eq } from 'drizzle-orm';
import type { CaptureSession } from '~/features/capture/model/capture';
import { db } from '~/lib/db';
import { captureSession } from '~/schema';

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
