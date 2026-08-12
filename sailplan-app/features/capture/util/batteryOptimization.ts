import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { MMKV } from 'react-native-mmkv';
import Constants from 'expo-constants';

/**
 * Doze's network rules, and the one thing that survives them.
 *
 * A `connectedDevice` foreground service keeps the *process* alive in deep
 * Doze. It does not keep the *socket* alive. MT5 measured both halves on real
 * hardware, same rig, one variable changed:
 *
 * | | socket survived |
 * | --- | --- |
 * | no exemption | **2 m 43 s**, then Android destroyed it |
 * | exemption granted | **13.7 min and still going** |
 *
 * Worse than the death itself: nothing noticed. The process, the service and
 * the notification all stayed up, and the recording bar went on showing a
 * healthy ticking timer for 35 minutes over a connection that no longer
 * existed. Until ticket `08` lands there is no detection at all, so the
 * exemption is the only thing standing between a pocketed phone and a race
 * recorded as three minutes of NMEA.
 */
const storage = new MMKV();

/** Set once the sailor has been shown the system dialog. */
const ASKED_KEY = 'capture.batteryExemptionAsked';

/**
 * Android's own action for "ask to be exempted from battery optimisation".
 * Shows a system dialog naming the app; one tap and Doze stops applying.
 */
const REQUEST_ACTION =
  'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS' as IntentLauncher.ActivityAction;

/** The per-app battery screen, for changing the answer later. */
const SETTINGS_ACTION =
  'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' as IntentLauncher.ActivityAction;

function packageName(): string | null {
  return Constants.expoConfig?.android?.package ?? null;
}

/** Whether the sailor has been shown the dialog at least once. */
export function hasAskedBatteryExemption(): boolean {
  if (Platform.OS !== 'android') return true;
  return storage.getBoolean(ASKED_KEY) ?? false;
}

/**
 * Shows Android's exemption dialog.
 *
 * **Deliberately returns nothing about the outcome.** There is no way to read
 * `isIgnoringBatteryOptimizations` from JS without a native module, so this
 * cannot report whether the sailor tapped Allow — and pretending otherwise
 * would be worse than admitting it, because the failure it guards against is
 * already silent. The caller records only that the ask happened; see
 * {@link openBatteryOptimizationSettings} for the way back.
 */
export async function requestBatteryExemption(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const pkg = packageName();
  if (!pkg) return;

  try {
    await IntentLauncher.startActivityAsync(REQUEST_ACTION, {
      data: `package:${pkg}`,
    });
  } catch {
    // A device that refuses the intent (some OEM builds do) must not block the
    // recording — the sailor can still grant it by hand, and a capture without
    // the exemption is degraded rather than impossible.
  } finally {
    storage.set(ASKED_KEY, true);
  }
}

/** Opens the per-app battery screen so the answer can be changed later. */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(SETTINGS_ACTION);
  } catch {
    // As above: informational, never load-bearing.
  }
}

/** Test seam — lets a fresh run re-show the dialog. */
export function resetBatteryExemptionPrompt(): void {
  storage.delete(ASKED_KEY);
}
