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
        // Asked before the socket opens, never enforced. A `connectedDevice`
        // service starts perfectly well without `POST_NOTIFICATIONS`; all that
        // is lost on Android 13+ is the ongoing notification in the drawer, and
        // Stop is reachable in-app from any screen regardless. Refusing to
        // record over it would also be unrecoverable: after two denials Android
        // returns `never_ask_again` without showing a dialog, so "retry and
        // allow the prompt" is advice no sailor could act on. The Plotter
        // connection section holds the route back to the system setting.
        await requestCaptureNotificationPermission();

        // Asked once, before the socket opens, for the same reason: spending
        // the ~31 s connect budget only to interrupt a working recording with a
        // dialog is worse than asking up front. Never blocks the start — a
        // declined exemption degrades the recording, it does not prevent it,
        // and MT5 showed the degradation is invisible until `08` adds
        // detection.
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

  // Every orphan, not just the newest: a run that stranded two rows would
  // otherwise clear one per launch and leave the rest `active` forever, and
  // those rows are what `08`'s resume and `13`'s session list read.
  const orphans = await db.query.captureSession.findMany({
    where: eq(captureSession.status, 'active'),
  });
  const endedAt = Date.now();
  for (const orphan of orphans) await endCaptureSession(orphan.id, endedAt);
  await stopCaptureForegroundService();
}
