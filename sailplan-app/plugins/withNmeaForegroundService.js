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

const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
  // Keeps the CPU alive with the screen off.
  //
  // **This is not sufficient on its own, and it was once assumed to be.** MT5
  // measured a phone in deep Doze with this permission held and the
  // `connectedDevice` service running: the process survived, the service
  // survived, and Android destroyed the TCP socket anyway at 2 m 43 s
  // (`Destroyed live tcp sockets for uids={[10000, 2147483647]}`), with the UI
  // still showing a healthy recording 35 minutes later. A wake lock keeps the
  // CPU running; it does not exempt the app from Doze's *network* rules.
  // That needs the battery-optimisation exemption below.
  'android.permission.WAKE_LOCK',
  // Lets the app ask, in one tap, to be exempted from Doze. The same run
  // showed the socket surviving 13.7 minutes of deep Doze with the exemption
  // granted and dying at 2 m 43 s without it. Requesting it still shows a
  // system dialog the sailor must accept — an app cannot exempt itself.
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
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

  config = withAndroidManifest(config, cfg => {
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

  // RNBA owns the foreground notification but exposes no action-button API.
  // Add the one action the capture design permits: a deep link back into the
  // running JS recorder, which closes the raw log and session through the same
  // stop path as the deliberate hold in-app. This runs on every prebuild, is
  // idempotent, and fails loudly if an RNBA upgrade changes the source seam.
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const sourcePath = path.join(
        cfg.modRequest.projectRoot,
        'node_modules/react-native-background-actions/android/src/main/java/com/asterinet/react/bgactions/RNBackgroundActionsTask.java',
      );
      const marker = 'SAILPLAN_CAPTURE_STOP_ACTION';
      let source = fs.readFileSync(sourcePath, 'utf8');
      if (source.includes(marker)) return cfg;

      const builderNeedle = '                .setColor(color);';
      const builderReplacement = `                .setColor(color)
                // ${marker}
                .addAction(0, "Stop", buildCaptureStopIntent(context, linkingURI, contentIntent));`;
      const methodNeedle = '\n    @Override\n    protected @Nullable\n    HeadlessJsTaskConfig getTaskConfig(Intent intent) {';
      const methodReplacement = `
    private static PendingIntent buildCaptureStopIntent(
            @NonNull Context context,
            @Nullable String linkingURI,
            @NonNull PendingIntent fallbackIntent) {
        if (linkingURI == null) return fallbackIntent;
        final String separator = linkingURI.contains("?") ? "&" : "?";
        final Intent stopIntent = new Intent(
                Intent.ACTION_VIEW,
                Uri.parse(linkingURI + separator + "stopCapture=true"));
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, 92902, stopIntent, flags);
    }

    @Override
    protected @Nullable
    HeadlessJsTaskConfig getTaskConfig(Intent intent) {`;

      if (!source.includes(builderNeedle) || !source.includes(methodNeedle)) {
        throw new Error(
          'react-native-background-actions changed; update the SailPlan Stop action patch',
        );
      }
      source = source
        .replace(builderNeedle, builderReplacement)
        .replace(methodNeedle, methodReplacement);
      fs.writeFileSync(sourcePath, source);
      return cfg;
    },
  ]);
};
