import { eq } from 'drizzle-orm';
import { db } from '~/lib/db';
import { captureSession } from '~/schema';
import { endCaptureSession } from '../api/captureSession';
import { startCaptureRecording, type CaptureRecording } from './captureRecorder';
import { stopCaptureForegroundService } from './captureForegroundService';

let activeRecording: CaptureRecording | null = null;

export async function beginCaptureRecording(
  input: Parameters<typeof startCaptureRecording>[0],
): Promise<CaptureRecording> {
  if (activeRecording) throw new Error('A recording is already active');
  activeRecording = await startCaptureRecording(input);
  return activeRecording;
}

/** Handles both the in-app control and the notification deep link. */
export async function stopActiveCaptureRecording(): Promise<void> {
  if (activeRecording) {
    const recording = activeRecording;
    activeRecording = null;
    await recording.stop();
    return;
  }

  // A notification action can relaunch the app after Android recreated its JS
  // runtime. End the one persisted active session rather than leaving a stale
  // recording row behind; the socket is no longer reachable from that runtime.
  const session = await db.query.captureSession.findFirst({
    where: eq(captureSession.status, 'active'),
  });
  if (session) await endCaptureSession(session.id, Date.now());
  await stopCaptureForegroundService();
}
