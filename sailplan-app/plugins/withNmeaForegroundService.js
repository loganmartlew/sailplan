// The manifest half of NMEA capture's foreground service.
//
// The service itself belongs to `react-native-background-actions`, the stack
// ticket `13` proved on hardware. Its library manifest declares the service
// with **no** `foregroundServiceType`:
//
//   <service android:name=".RNBackgroundActionsTask"/>
//
// The manifest attribute and the `startForeground` type argument must match or
// Android throws `InvalidForegroundServiceTypeException` at start, so we merge
// the attribute onto a service we do not own. `tools:node="merge"` is the
// explicit form of what the merger would do anyway — spelled out because
// eas-cli#2556 reports this exact attribute being silently blanked in EAS
// builds. Verify it survived in the merged manifest after any prebuild.

const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
  // Keeps the CPU alive with the screen off. Without it a race-length capture
  // is at the mercy of Doze.
  'android.permission.WAKE_LOCK',
  // The runtime prerequisite that legitimises the `connectedDevice` type.
  // Normal (install-time) permission — no runtime prompt.
  'android.permission.CHANGE_WIFI_STATE',
  'android.permission.ACCESS_NETWORK_STATE',
  // The service runs without this; the ongoing notification is merely hidden
  // from the drawer on Android 13+ if it is not granted.
  'android.permission.POST_NOTIFICATIONS',
];

const SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';

const TOOLS_NS = 'http://schemas.android.com/tools';

module.exports = function withNmeaForegroundService(config) {
  config = AndroidConfig.Permissions.withPermissions(config, PERMISSIONS);

  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ ?? {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = TOOLS_NS;
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults,
    );
    app.service = app.service ?? [];

    const attrs = {
      'android:name': SERVICE,
      'android:foregroundServiceType': 'connectedDevice',
      // Survives the task being swiped out of Recents. A recording must not
      // end because the user tidied their app switcher mid-race.
      'android:stopWithTask': 'false',
      'tools:node': 'merge',
    };

    const existing = app.service.find(s => s.$?.['android:name'] === SERVICE);
    if (existing) Object.assign(existing.$, attrs);
    else app.service.push({ $: attrs });

    return cfg;
  });
};
