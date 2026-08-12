import { eq } from 'drizzle-orm';
import { create } from 'zustand';
import { db } from '~/lib/db';
import { captureSample, captureSession } from '~/schema';
import { endCaptureSession } from '../api/captureSession';
import type { CaptureSession } from '../model/capture';
import type { CaptureConnectionState } from '../model/captureLayerState';
import { AUTO_END_AFTER_MS } from '../model/connectionLossPolicy';
import {
  requestCaptureNotificationPermission,
  stopCaptureForegroundService,
  updateCaptureForegroundService,
} from '../util/captureForegroundService';
import {
  hasAskedBatteryExemption,
  requestBatteryExemption,
} from '../util/batteryOptimization';
import {
  startCaptureRecording,
  type CaptureRecording,
} from '../util/captureRecorder';
import { vibrateForCaptureAlert } from '../util/captureAlerts';
import {
  dismissNotificationsForCapture,
  postCaptureAutoEndedNotification,
} from '../util/captureNotifications';

type StartInput = Parameters<typeof startCaptureRecording>[0];

export type CaptureStampHistory = {
  id: number;
  sailId: number;
  sailName: string;
  sailColor: string;
  timestamp: number;
};

/**
 * Recording is app-wide, not screen-local: the capture layer sits above the tab
 * navigator and any screen may show it. Holding this in a screen's `useState`
 * lets the UI disagree with the actual recording the moment the sailor
 * navigates away, so it lives here instead.
 */
interface CaptureRecordingStore {
  /** The live recording handle. `null` whenever nothing is being recorded. */
  recording: CaptureRecording | null;
  live: CaptureRecording['live'];
  connection: CaptureConnectionState;
  lastStamp: CaptureStampHistory | null;
  isConnecting: boolean;
  isStopping: boolean;
  /**
   * Set by the paths that have no component of their own to report through —
   * the notification action handler above all, where a swallowed failure looks
   * to the sailor like a button that does nothing. The capture layer renders
   * it. Screens with their own error UI keep using that instead.
   */
  failure: string | null;
  start: (input: StartInput) => Promise<void>;
  resume: (
    session: CaptureSession,
    endpoint: StartInput['endpoint'],
  ) => Promise<void>;
  stop: () => Promise<void>;
  setLastStamp: (stamp: CaptureStampHistory | null) => void;
  setFailure: (failure: string | null) => void;
}

const EMPTY_LIVE: CaptureRecording['live'] = {
  tws: null,
  twa: null,
  sampleCount: 0,
  lastSampleAt: null,
};

const IDLE_STATE = {
  recording: null,
  live: EMPTY_LIVE,
  connection: { status: 'connected' } as CaptureConnectionState,
  lastStamp: null,
};

export const useCaptureRecordingStore = create<CaptureRecordingStore>(
  (set, get) => {
    /**
     * Identical for `start` and `resume` apart from the course the auto-end
     * notification is filed under. Kept in one place so a change to how live
     * data, connection state or auto-end are handled cannot land on only one of
     * the two ways a recording begins.
     */
    const recordingCallbacks = (courseId: number) => ({
      onLiveData: (live: CaptureRecording['live']) => {
        set({ live });
        void updateCaptureForegroundService(
          live,
          get().lastStamp?.timestamp ?? null,
          get().connection,
        );
      },
      onConnectionState: (connection: CaptureConnectionState) => {
        set({ connection });
        void updateCaptureForegroundService(
          get().live,
          get().lastStamp?.timestamp ?? null,
          connection,
        );
      },
      onConnectionAlert: vibrateForCaptureAlert,
      onAutoEnded: (sessionId: number) => {
        set({ ...IDLE_STATE });
        void postCaptureAutoEndedNotification(
          sessionId,
          courseId,
          AUTO_END_AFTER_MS,
        ).catch(() => undefined);
      },
    });

    const adoptRecording = (recording: CaptureRecording) => {
      set({
        ...IDLE_STATE,
        recording,
        live: { ...recording.live },
        failure: null,
      });
      void updateCaptureForegroundService(recording.live, null, {
        status: 'connected',
      });
    };

    return {
      ...IDLE_STATE,
      isConnecting: false,
      isStopping: false,
      failure: null,

      start: async input => {
        if (get().recording || get().isConnecting) return;
        set({ isConnecting: true });
        try {
          // Asked before the socket opens, never enforced. A `connectedDevice`
          // service starts perfectly well without `POST_NOTIFICATIONS`; all
          // that is lost on Android 13+ is the ongoing notification in the
          // drawer, and Stop is reachable in-app from any screen regardless.
          // Refusing to record over it would also be unrecoverable: after two
          // denials Android returns `never_ask_again` without showing a dialog,
          // so "retry and allow the prompt" is advice no sailor could act on.
          // The Plotter connection section holds the route back to the setting.
          await requestCaptureNotificationPermission();

          // Asked once, before the socket opens, for the same reason: spending
          // the ~31 s connect budget only to interrupt a working recording with
          // a dialog is worse than asking up front. Never blocks the start — a
          // declined exemption degrades the recording, it does not prevent it,
          // and MT5 showed the degradation is invisible until `08` adds
          // detection.
          if (!hasAskedBatteryExemption()) await requestBatteryExemption();
          adoptRecording(
            await startCaptureRecording({
              ...input,
              ...recordingCallbacks(input.courseId),
            }),
          );
        } finally {
          set({ isConnecting: false });
        }
      },

      resume: async (session, endpoint) => {
        if (get().recording || get().isConnecting || session.courseId === null) {
          return;
        }
        set({ isConnecting: true });
        try {
          adoptRecording(
            await startCaptureRecording({
              boatProfileId: session.boatProfileId,
              courseId: session.courseId,
              endpoint,
              resumeSession: {
                id: session.id,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                rawLogPath: session.rawLogPath,
              },
              ...recordingCallbacks(session.courseId),
            }),
          );
          await dismissNotificationsForCapture(session.id).catch(
            () => undefined,
          );
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
          set({ ...IDLE_STATE });
        } finally {
          set({ isStopping: false });
        }
      },

      setLastStamp: lastStamp => {
        set({ lastStamp });
        const { recording, live } = get();
        if (recording) {
          void updateCaptureForegroundService(
            live,
            lastStamp?.timestamp ?? null,
            get().connection,
          );
        }
      },

      setFailure: failure => set({ failure }),
    };
  },
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
  for (const orphan of orphans) {
    // The last sample, not the wall clock. This runs at the *next* launch,
    // which can be days after the recording actually stopped producing data,
    // and the session window is what `14`/`17` read to derive legs — trailing
    // silence must contribute nothing, exactly as it does for an auto-end.
    const lastSample = await db.query.captureSample.findFirst({
      where: eq(captureSample.captureSessionId, orphan.id),
      orderBy: (row, { desc }) => [desc(row.timestamp)],
    });
    await endCaptureSession(orphan.id, lastSample?.timestamp ?? orphan.startedAt);
  }
  await stopCaptureForegroundService();
}
