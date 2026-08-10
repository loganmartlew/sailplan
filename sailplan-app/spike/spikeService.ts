// THROWAWAY — ticket `13` device spike only.
//
// Starts the `connectedDevice` foreground service and runs the capture inside
// it. `react-native-background-actions` is a spike-only dependency: if it
// proves out, `research/02` §1e says port these ~40 lines into a local Expo
// module we own and delete the package.

import { PermissionsAndroid, Platform } from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { captureTask, finishCapture, type SpikeConfig } from './spikeCapture';
import { logEvent, spikeDb } from './spikeDb';

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(
    'android.permission.POST_NOTIFICATIONS' as any
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function startSpike(cfg: SpikeConfig) {
  if (BackgroundService.isRunning()) return;

  await BackgroundService.start(async () => captureTask(cfg), {
    taskName: 'NmeaSpike',
    taskTitle: 'NMEA capture spike',
    taskDesc: `${cfg.host}:${cfg.port}`,
    taskIcon: { name: 'ic_launcher', type: 'mipmap' },
    linkingURI: 'sailplan://spike',
    // The decision from `research/02` §4. `dataSync` would be capped at
    // 6 h/24 h on Android 15+; this must match the manifest attribute the
    // config plugin merges on, or Android throws at startForeground.
    foregroundServiceType: ['connectedDevice'],
  });
}

export async function stopSpike() {
  finishCapture();
  await BackgroundService.stop();
}

/**
 * `onTimeout` surfaces here. `connectedDevice` is not documented to time out,
 * so anything arriving on this listener is itself a finding.
 */
BackgroundService.on('expiration', () => {
  try {
    const db = spikeDb();
    const row = db.getFirstSync<{ id: number }>(
      `SELECT id FROM spike_run ORDER BY id DESC LIMIT 1`
    );
    if (row) logEvent(row.id, 'service_expiration');
  } catch {
    // nothing useful to do if even the log write fails
  }
});
