import { PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';

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
 *
 * **The answer never gates recording.** A `connectedDevice` service starts
 * without `POST_NOTIFICATIONS`; only the drawer notification is hidden on
 * Android 13+. The boolean is reported so a caller can explain the degraded
 * state, not so it can refuse — see {@link openNotificationSettings} for the
 * way back once Android has stopped showing the prompt at all.
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

/**
 * Opens this app's notification screen. The only route back once Android has
 * recorded two denials and started answering the permission request with
 * `never_ask_again` — no dialog is shown from then on, so an in-app retry can
 * never recover it.
 */
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = Constants.expoConfig?.android?.package;
  if (!pkg) return;

  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.APP_NOTIFICATION_SETTINGS' as IntentLauncher.ActivityAction,
      { extra: { 'android.provider.extra.APP_PACKAGE': pkg } },
    );
  } catch {
    // Informational, never load-bearing: recording works without it.
  }
}
