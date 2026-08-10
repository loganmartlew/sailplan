# The ticket `13` spike rig

Throwaway. Everything in this directory, plus `app/spike.tsx`,
`plugins/withNmeaSpikeForegroundService.js` and the two spike dependencies
(`react-native-background-actions`, kept; `react-native-tcp-socket`, likely
kept) gets deleted or promoted when
[`13`](../../.tickets/nmea-ingestion/issues/13-device-spike-background-capture.md)
closes.

It exists to answer one question with evidence rather than inference: **does a
TCP capture survive the phone being backgrounded, screen off, for a race?**
Founding decision 6 rests on the answer.

## What is here

| Piece | What it is |
| --- | --- |
| `spikeCapture.ts` | The capture path. Socket → line split → `05`'s anchor rule → batched SQLite writes → raw log append. **No JS timer anywhere on this path** — see below. |
| `spikeDb.ts` | `spike.db`, a database of its own so the spike can never touch real data. Three tables: run, sample, event. |
| `spikeService.ts` | Starts the `connectedDevice` foreground service via `react-native-background-actions` and runs the capture inside it. |
| `../app/spike.tsx` | The screen. Not linked from the app — deep-link only. |
| `../plugins/withNmeaSpikeForegroundService.js` | The manifest half: permissions plus `android:foregroundServiceType="connectedDevice"` merged onto RNBA's service. |
| `report.mjs` | Pulls `spike.db` off the phone and scores it. Item 3 says *count them, don't eyeball it*; this is the counting. |
| `tierb.sh` | The Tier B walk: forces screen-off, deep Doze and the restricted bucket over adb, probing process state at each phase. |

The one `setInterval` in `spikeCapture.ts` is **item 4's probe**, not part of the
pipeline. Nothing depends on it firing; its stalls are recorded as evidence.
Emission, batching and flushing all hang off socket `data` arrival, which is
what `research/02` §1f requires and what `05` confirmed is sufficient.

## Building it on this box

Two toolchain traps, both hit while building the rig, both nothing to do with
the spike itself — they are how a local `expo run:android` behaves on Fedora
with only JDK 25 installed.

1. **React Native's Gradle plugin needs a JDK 17 toolchain**, and Gradle cannot
   auto-provision one: the foojay resolver RN pins (0.5.0) references
   `JvmVendorSpec.IBM_SEMERU`, which Gradle 9 removed, so provisioning dies with
   `NoSuchFieldError` before it downloads anything. Fixed by putting a JDK 17
   in `~/.gradle/jdks/` and pointing at it from `~/.gradle/gradle.properties`
   (user-level, so `expo prebuild --clean` cannot wipe it):

   ```properties
   org.gradle.java.installations.paths=/home/logan/.gradle/jdks/jdk-17.0.20+8
   ```

2. **Gradle itself must run on JDK 17, not 25.** On 25 the CMake configure step
   for every library with C++ (skia, screens, worklets) fails with
   `WARNING: A restricted method in java.lang.System has been called` — a JEP
   472 warning on stderr that AGP treats as a failure.

   ```sh
   export ANDROID_HOME=$HOME/Android/Sdk
   export JAVA_HOME=$HOME/.gradle/jdks/jdk-17.0.20+8
   npx cross-env APP_VARIANT=development npx expo run:android
   ```

## Reaching the screen

It is deliberately not in the tab bar:

```sh
adb shell am start -a android.intent.action.VIEW -d "sailplan://spike"
```

## Running it

### Tier A — volume, fast-forwarded, phone in hand

Three hours of sentences in three minutes. Exercises the parser, the buffer,
the batched inserts and the full race-scale row count while proving nothing
about the OS.

```sh
cd nmea-sim
node nmea-sim.js generate --duration 10800 --out logs/3h.log
node nmea-sim.js replay logs/3h.log --speed 60
```

Then Start on the spike screen with the coalesce window set to **0 ms** — the
window is wall-clock, so at 60× a 250 ms window caps emission at 4 Hz and turns
a three-hour volume test into a three-minute one.

Tiers A and B need no WiFi at all. `adb reverse` carries the simulator over
USB, so point the spike at `127.0.0.1`:

```sh
adb reverse tcp:10110 tcp:10110
```

### Tier B — time, forced rather than waited out, on an emulator

The states a 3-hour run is waiting for are reachable over adb in seconds. See
the ticket's protocol for the full list; the short version:

```sh
adb shell dumpsys battery unplug          # framework believes it is discharging
adb shell dumpsys deviceidle force-idle   # deep Doze now
adb shell am set-standby-bucket com.loganmartlew.sailplan.dev restricted
adb shell input keyevent 26               # screen off
adb shell dumpsys activity processes | grep -A2 sailplan   # cached bucket?
adb logcat | grep -i "freez\|froze"
```

Item 2's real time constant is ~10 seconds, not 3 hours: if the foreground
service fails to keep the process out of the cached bucket, the first
screen-off says so.

The walk that produced the Tier B numbers is `tierb.sh`, next to this file —
four phases (baseline, screen-off, forced deep Doze, restricted
bucket), probing `oom_score_adj`, cpuset, FGS count, standby bucket and the
socket at each. Run the capture at the **250 ms** window here, not 0 ms: Tier B
is about wall-clock time, so coverage has to stay meaningful.

**The AVD needs `-gpu host` on this box.** The bundled SwiftShader crashes the
emulator ~7 s into guest boot, right as surfaceflinger comes up — the core dump
lands in `lib64/gles_swiftshader/libGLESv2.so`, its JIT calling a bad address.
It is not the KVM path: `-accel off` dies at the same place. `-gpu swiftshader`,
`-gpu guest` and the default `auto` all route through it and all crash, so pin
the AVD:

```properties
# ~/.android/avd/spike36.avd/config.ini
hw.gpu.enabled = yes
hw.gpu.mode = host
```

A fresh AVD has no boat profile, and the app gates on one — create a profile
before the `sailplan://spike` deep link will stay put.

### Tier C — the three items an emulator cannot reach

Needs the phone and the hotspot rig. **`nmea-sim/hotspot.sh` isolates the AP by
default** — NetworkManager's hotspot mode would otherwise NAT the phone out
through this box's ethernet, the phone would validate the network, and item 5's
trap could not reproduce at all.

```sh
sudo ./hotspot.sh up      # 10.42.0.1, no internet behind it
node nmea-sim.js sail --script scripts/nasty.json
```

On the phone: join `ZeusSim`, **dismiss** the no-internet prompt (do not tap
"stay connected" — the choice is sticky, forget the network to reset it), leave
mobile data **on**. Then run the spike twice, once with `interface: 'wifi'` off
and once on. Off should fail; on should connect. That is item 5.

## Reading the result

```sh
node spike/report.mjs              # pulls from the device over adb, then scores
node spike/report.mjs --run 3
```

Trust `report.mjs`, not the screen. The live `uptime` field reads `0s`
permanently — `reactCompiler` is on, and it memoises the render-time
`Date.now() - startedAt` expression against its reactive inputs, which
`Date.now()` is not. Left unfixed: it is a throwaway display field and the
database is the evidence.

Coverage is rows written against the seconds elapsed — the stream is 1 Hz, so
one row per second is the ceiling. A hole is a gap over 3 s between consecutive
samples; a service that dies and silently restarts looks fine on screen and
shows up here.
