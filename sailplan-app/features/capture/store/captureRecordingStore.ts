import { eq } from 'drizzle-orm';
import { create } from 'zustand';
import { db } from '~/lib/db';
import { captureSession } from '~/schema';
import { endCaptureSession } from '../api/captureSession';
import {
  requestCaptureNotificationPermission,
  stopCaptureForegroundService,
} from '../util/captureForegroundService';
import {
  hasAskedBatteryExemption,
  requestBatteryExemption,
} from '../util/batteryOptimization';
import { CaptureRecordingStartError } from '../model/captureRecordingError';
import {
  startCaptureRecording,
  type CaptureRecording,
} from '../util/captureRecorder';

type StartInput = Parameters<typeof startCaptureRecording>[0];

/**
 * Recording is app-wide, not screen-local: the capture layer sits above the tab
 * navigator and any screen may show it. Holding this in a screen's `useState`
 * lets the UI disagree with the actual recording the moment the sailor
 * navigates away, so it lives here instead.
 */
interface CaptureRecordingStore {
  /** The live recording handle. `null` whenever nothing is being recorded. */
  recording: CaptureRecording | null;
  isConnecting: boolean;
  isStopping: boolean;
  start: (input: StartInput) => Promise<void>;
  stop: () => Promise<void>;
}

export const useCaptureRecordingStore = create<CaptureRecordingStore>(
  (set, get) => ({
    recording: null,
    isConnecting: false,
    isStopping: false,

    start: async input => {
      if (get().recording || get().isConnecting) return;
      set({ isConnecting: true });
      try {
        if (!(await requestCaptureNotificationPermission())) {
          throw new CaptureRecordingStartError(
            'preparing',
            'notification-permission-denied',
            new Error('POST_NOTIFICATIONS was not granted'),
          );
        }

        // Asked once, before the socket opens, for the same reason the
        // notification permission is: spending the ~31 s connect budget only
        // to interrupt a working recording with a dialog is worse than asking
        // up front. Never blocks the start — a declined exemption degrades the
        // recording, it does not prevent it, and MT5 showed the degradation is
        // invisible until `08` adds detection.
        if (!hasAskedBatteryExemption()) await requestBatteryExemption();
        const recording = await startCaptureRecording(input);
        set({ recording });
      } finally {
        set({ isConnecting: false });
      }
    },

    stop: async () => {
      const recording = get().recording;
      if (!recording || get().isStopping) return;
      set({ isStopping: true });
      try {
        // Cleared only once the stop has actually succeeded. Dropping the
        // handle first would strand a failed stop with no way to retry it and
        // leave the session row `active` forever.
        await recording.stop();
        set({ recording: null });
      } finally {
        set({ isStopping: false });
      }
    },
  }),
);

/**
 * Ends any session left `active` by a previous JS runtime — Android can tear
 * the runtime down and relaunch the app from the notification, and that session
 * has no reachable socket. Safe to call on every launch; a recording started in
 * this runtime is never touched.
 */
export async function endOrphanedCaptureSessions(): Promise<void> {
  if (useCaptureRecordingStore.getState().recording) return;

  const orphan = await db.query.captureSession.findFirst({
    where: eq(captureSession.status, 'active'),
  });
  if (orphan) await endCaptureSession(orphan.id, Date.now());
  await stopCaptureForegroundService();
}
