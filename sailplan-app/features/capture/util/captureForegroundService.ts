import { PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { CaptureRecordingStartError } from '../model/captureRecordingError';

/**
 * `connectedDevice`, never `dataSync` — Android 15 caps `dataSync` at 6 h per
 * 24 h, which is inside a race-length run. The manifest attribute is merged on
 * by `plugins/withNmeaForegroundService.js` and the two must agree, or Android
 * throws `InvalidForegroundServiceTypeException` at start.
 */
const FOREGROUND_SERVICE_TYPE = ['connectedDevice'] as const;

/**
 * The service keeps the process alive for exactly as long as its task promise
 * is pending. Recording itself hangs off socket `data` events, so the task has
 * no work of its own: it parks until {@link stopCaptureForegroundService}
 * releases it. Deliberately not a loop or a timer — `JavaTimerManager` drops
 * timer callbacks while backgrounded, which is the whole reason for this
 * design.
 */
let releaseTask: (() => void) | undefined;

/**
 * Asked *before* the socket is opened. Prompting afterwards would spend the
 * ~31 s connect budget only to tear a working connection down over a dialog the
 * sailor could have answered up front.
 */
export async function requestCaptureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function startCaptureForegroundService(sessionId: number) {
  if (Platform.OS !== 'android') return;

  await BackgroundService.start(
    () =>
      new Promise<void>(resolve => {
        releaseTask = resolve;
      }),
    {
      taskName: 'NmeaCapture',
      taskTitle: 'Recording this course',
      taskDesc: 'SailPlan is recording NMEA data',
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      // RNBA's notification carries no action buttons — only a tap target.
      // Tapping opens the app, where the capture layer's Stop sits above the
      // tab navigator and is reachable from any screen.
      linkingURI: `sailplan://?captureSessionId=${sessionId}`,
      foregroundServiceType: [...FOREGROUND_SERVICE_TYPE],
    },
  );
}

export async function stopCaptureForegroundService() {
  if (Platform.OS !== 'android') return;

  releaseTask?.();
  releaseTask = undefined;
  if (BackgroundService.isRunning()) await BackgroundService.stop();
}

export function isCaptureForegroundServiceRunning() {
  return Platform.OS === 'android' && BackgroundService.isRunning();
}
