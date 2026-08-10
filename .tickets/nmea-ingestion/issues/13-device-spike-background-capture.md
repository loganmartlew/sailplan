# 13 — Device spike: prove the screen-off capture survives a race

Type: task
Status: resolved
Blocked by: 14
Map: [map.md](../map.md)

## Question

`02` passed the feasibility gate **on documentation**, and named this spike as
the condition for the verdict standing. Nothing in `02`'s recommended stack has
a published 3-hour screen-off report for this exact combination — the research
looked and found none. Until this runs, founding decision 6 rests on inference.

Build the smallest possible thing that proves it, on real hardware. This is
throwaway — it is not the feature.

Per `02`'s recommendation, spike with `react-native-background-actions@4.1.0`
first (fastest path to a running foreground service), then port to a local Expo
module. Stream from `14`'s simulator, not the boat.

## What to prove

In order of how much damage each does if it fails:

1. **A `connectedDevice` foreground service starts at all.** The app currently
   has **no** `FOREGROUND_SERVICE*` permissions in its manifest, so this needs
   the `app.config.js` plugin changes `02` specifies plus a prebuild. Confirm
   `dataSync` is *not* used — Android 15 caps it at 6 h/24 h.
2. **The TCP socket survives being genuinely backgrounded.** The failure mode is
   the cached-app freezer terminating sockets ~10 s after the process is cached,
   so the test must be genuinely backgrounded and genuinely idle, not just
   dimmed.
3. **Writes keep landing.** SQLite rows accumulate with no gap, at race volume
   and across the power-management transitions. Count them; don't eyeball it.
4. **Does `Choreographer` deliver frames with the display off?** Test a
   `setInterval` and see whether it survives. **Downgraded to informational —
   see "What changed since this was written" below.**
5. **`interface: 'wifi'` behaves as expected** against an access point with no
   internet, using `12`'s Fedora hotspot rig. Both `02` and `12` independently
   concluded this is the fix for `11`'s worst trap — confirm it.
6. **OEM battery management on this specific phone.** `02` calls this the real
   killer. Establish whether the service survives, whether
   `isIgnoringBatteryOptimizations()` needs to gate recording, and what the
   user-facing consequence is.
7. **Battery cost over a race**, since a race day may involve more than one.
8. **Does `react-native-background-actions@4.1.0` even build on AGP 8.12?**
   `02` could not establish this. If it doesn't, skip straight to the local
   Expo module.

## The protocol

`02`'s validation plan called for a single unbroken 3-hour screen-off run.
Logan does not have a spare device and cannot surrender his phone for three
hours, so that plan is replaced. It conflated two independent axes — the
**volume** of data and the **passage of wall-clock time** — and each compresses
on its own.

**Tier A — volume, fast-forwarded, phone in hand.** `nmea-sim` can write three
hours of timestamped log in a second and replay it at 60×:

```
node nmea-sim.js generate --duration 10800 --out logs/3h.log
node nmea-sim.js replay logs/3h.log --speed 60
```

Three hours of sentences in three minutes. Exercises the parser, the buffer, the
batched inserts and the full race-scale row count (item 3's volume half) while
proving nothing about the OS — which is the point.

**Tier B — time, forced rather than waited out, on an emulator.** The states a
3-hour run is waiting for are all reachable over adb in seconds, so they run
unattended on an AVD while the phone stays in Logan's pocket:

- `dumpsys battery unplug` — the framework believes it is discharging while adb
  stays attached. This is what gates Doze and the standby buckets.
- `dumpsys deviceidle force-idle` — deep Doze now, instead of 30+ minutes of
  stationary idle. `deviceidle step` walks the states to see which one bites.
- `am set-standby-bucket <pkg> restricted` — worst-case bucket immediately.
- `cmd deviceidle whitelist -<pkg>` — the battery-optimised, non-exempt case.
- `input keyevent 26` — screen off with USB attached;
  `dumpsys activity processes` shows whether the process ever reaches the cached
  bucket, and logcat whether it is ever frozen.

Covers items 1, 2, 3, 4 and 8. **Item 2's real time constant is ~10 seconds,
not 3 hours** — if the foreground service fails to keep the process out of the
cached bucket, the first screen-off says so.

**Tier C — the three items an emulator cannot reach, on the phone, ~45 minutes
total in bursts.** Emulator networking is NAT'd through the host, so there is no
second interface to bind wrongly (item 5); there is no OEM skin on an AVD, which
is exactly the layer item 6 is about; and the battery is synthetic (item 7).

- **Item 5** — join `ZeusSim`, confirm the connection fails without
  `interface: 'wifi'` and succeeds with it. ~10 min, screen on, phone in hand.
- **Item 6** — force the restricted bucket and the non-exempt state over adb,
  screen off, 15–20 min.
- **Item 7** — 20–30 min genuinely unplugged, then extrapolate from
  `dumpsys batterystats`. The workload is constant (1 Hz socket, batched
  writes), so linear extrapolation is adequate for the decision it feeds.

**Optional top-up.** An overnight run costs nothing — the phone is untouched
anyway, mobile data keeps working throughout (that is the premise of the
`interface: 'wifi'` trap), and it measures item 7 properly instead of
extrapolating. Not a prerequisite.

## The device

**Asus Zenfone 10.** ZenUI is close to stock AOSP, which puts item 6 in the
mild band rather than the Xiaomi/Huawei band `02` was worried about — expect the
standard AOSP `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` path to be
sufficient, but check Asus's own auto-start / PowerMaster manager for a second
gate before concluding that.

**The OS version assumption in this ticket was wrong, in our favour.** It
predicted the Zenfone 10 would top out around Android 13 (API 33), well below
the app's target, making the emulator the only place the target API level got
tested. **The phone is actually on Android 15 (API 35)** — confirmed by Logan.

That materially strengthens Tier C: **item 1's Android 15 `dataSync` 6 h/24 h
cap is now testable on real hardware**, not just inferred, and the FGS
behaviour changes this ticket worried about can be exercised on the device that
will actually be recording races.

Still confirm at prebuild whether Expo SDK 55 targets API 35 or 36 — the app
sets no explicit `targetSdkVersion` in `app.config.js`, so it takes the SDK
default. If the target is 36, keep an AVD at that level for Tier B; if it is
35, the phone covers it and the emulator is a convenience again rather than a
necessity.

## What changed since this was written

- **Item 4 has decayed.** This ticket says the `Choreographer` question is
  `02`'s most important unknown and that "`05`'s sampling model depends on this
  answer". `05` has since resolved to **anchor-triggered emission on `MWV,T` or
  `VHW` with a 250 ms coalesce window**, explicitly finding that no native tick
  is needed. The answer no longer gates a design decision. Log whether
  `setInterval` fires and move on — **do not build the native Kotlin tick** this
  ticket originally called for.
- **The residual risk is named, not eliminated.** OEM long-horizon killers are
  the one thing adb cannot fast-forward. `02` §6 fallback 2 (persist
  continuously, stitch a killed session back together) is already the design —
  `11` decided the auto-end-and-resume behaviour independently — so this failing
  degrades to a data gap, not a lost race. The true regression test is the first
  real race, by which point the recovery path exists.

## Resolution

Resolved when the answer records: pass or fail per item, **which tier proved
each one** (fast-forwarded, forced, or observed in real time — they are not
equally strong evidence), the actual stack that worked, the `app.config.js` diff
required, and — if anything failed — what it means for founding decision 6.

> **Unblocked by `14`.** The rig exists: `nmea-sim/hotspot.sh up` brings up the
> access point on `10.42.0.1`. Two notes for whoever takes this:
>
> - `hotspot.sh up` and `hotspot.sh blackhole` are **untested end to end** —
>   they need `sudo` and a phone, which `14` had neither of. This ticket is
>   their first real run; expect to fix the script, and fix it in place.
> - For item 5 to mean anything the test phone must have **working mobile
>   data**, and must **not** have tapped "stay connected" on the no-internet
>   prompt for that SSID (the choice is sticky — forget the network to reset
>   it). The script prints both conditions when it starts.

## Progress

**Sessions 1–3.** Branch `spike/13-background-capture`. Session 1 built the rig
on the desk; session 2 drove Tier A on the phone; session 3 drove Tier B on the
`spike36` AVD. Six of the eight items are answered — everything left needs a
human, a hotspot and an unplugged phone.

What exists now (see [`sailplan-app/spike/README.md`](../../../sailplan-app/spike/README.md)):

- `spike/spikeCapture.ts` — socket → line split → `05`'s anchor rule → batched
  SQLite writes → raw log append, **with no JS timer on the path**. The single
  `setInterval` is item 4's probe; its stalls are recorded as evidence and
  nothing depends on it firing.
- `spike/spikeDb.ts` — `spike.db`, separate from `sailplan.db`. Run / sample /
  event tables; every sample carries `gap_ms` so holes are countable after the
  fact rather than eyeballed live.
- `spike/spikeService.ts` — `react-native-background-actions@4.1.0` with
  `foregroundServiceType: ['connectedDevice']`.
- `plugins/withNmeaSpikeForegroundService.js` — permissions plus the
  `connectedDevice` attribute merged onto RNBA's own service. **Verified in the
  generated manifest** after `expo prebuild --clean`:
  `<service android:name="com.asterinet.react.bgactions.RNBackgroundActionsTask" android:foregroundServiceType="connectedDevice" android:stopWithTask="false" tools:node="merge"/>`,
  and all six permissions present. eas-cli#2556's blanking did not occur.
- `app/spike.tsx` — deep-link-only screen (`sailplan://spike`), not in the tab bar.
- `spike/report.mjs` — pulls `spike.db` over `adb run-as` and scores coverage,
  holes and timer stalls with `node:sqlite`.

### Answered already

- **Item 1 — PASS, observed on the phone.** The `connectedDevice` foreground
  service starts on targetSdk 36 with no grace period:
  `ActivityManager: Background started FGS: Allowed … RNBackgroundActionsTask …
  targetSdkVersion:36`, and `dumpsys activity services` reports
  `isForeground=true types=0x00000010` — `FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE`
  exactly, **not** `dataSync`, so Android 15's 6 h/24 h cap does not apply.
  Notification posted, ongoing, `NO_CLEAR`. Stop tears the service down cleanly
  (no `ServiceRecord` afterwards). Evidence tier: **observed in real time.**
- **Item 3's volume half — PASS, fast-forwarded (Tier A).** Three hours of log
  replayed in 336 s: **302,400 sentences, 0 bad checksums, 21,600 samples,
  21,600 rows written** — samples equals rows, so nothing was dropped between
  emission and SQLite. 21,600 is exactly 2 × 10,800, i.e. both anchors on every
  simulated second, which is what a 0 ms window must produce and is a check on
  the emission rule as much as on throughput. Max inter-sample gap 89 ms; 13 MB
  received; raw log written alongside. This is **twice race volume in a twentieth
  of race time** and it proves the parser, buffer, batching and both write paths
  — and nothing about the OS, which is the point.
- **A real-time 1 Hz run also passes.** 80 s, 81 rows (101.3 % of 1 Hz), 0 holes,
  2,251 sentences, 0 bad checksums, max gap 1027 ms — the emission rule lands on
  1 Hz on real hardware, confirming `05` on the device for the first time.
- **A free data point on item 5's failure mode.** A run that went out with the
  default `10.42.0.1` and `interface: 'wifi'` **ON**, with no such host present,
  failed as `ETIMEDOUT` after **31 s** — bound `from /:: (port 40423)`. So the
  no-route case is a half-minute timeout, not a fast refusal. That is a number
  `11`'s reconnect ladder should be checked against: its first retry is
  immediate, but the *detection* of failure costs 31 s.
- **Item 2 — PASS, forced (Tier B).** On the `spike36` AVD (API 36, x86_64,
  targetSdk 36) the process was walked through screen-off, forced deep Doze and
  the `RESTRICTED` standby bucket while unplugged, and **never reached the
  cached bucket**: `oom_score_adj` held at **200** (perceptible, the FGS floor)
  from screen-off onward instead of falling to the 900s, cpuset stayed
  `/foreground`, the `ServiceRecord` stayed `isForeground=true`, and the socket
  stayed established through every phase. The cached-app freezer this item fears
  was demonstrably **live on the same device at the same time** — 250 freezer
  lines in logcat, ten other packages frozen including `com.google.android.gms`
  — and our pid appears in **none** of them. That is the control the item needed:
  the mechanism was running and the foreground service kept us out of its reach.
- **Item 3's screen-off half — PASS, forced (Tier B).** 579 s real-time run,
  **577 rows = 99.7 % of 1 Hz, 0 holes over 3 s**, 16,207 sentences, 0 bad
  checksums, worst inter-sample gap 1947 ms. **445 s of that — 00:04:12 to
  00:11:37 — was backgrounded with the screen off**, spanning deep Doze and the
  restricted bucket. Writes kept landing across every power-management
  transition, which is exactly what the item asked and what a 3-hour run was
  going to be waiting around to see.
- **Item 4 — answered, informational, and it vindicates the design rule.**
  `setInterval` **does** keep firing with the display off inside a
  `connectedDevice` FGS — 484 ticks across the run — but it is **not punctual**:
  4 stalls, worst **4985 ms**. The stalls cluster at the host pause/resume
  transitions (00:04:05 and 00:04:13 around backgrounding, 00:11:42 around
  foregrounding), not in steady-state Doze. In the very same window the
  socket-driven path's worst gap was 1947 ms with zero holes. A 1 Hz
  timer-driven sampler would have silently dropped ~5 seconds of a race at each
  transition; the anchor-driven path `05` specified dropped nothing. **No native
  Kotlin tick is needed**, per this ticket's own "What changed" note.
- **Item 1 also holds on API 36 hardware, not just the phone.** Same
  `types=0x00000010` on the AVD, and the same clean teardown on Stop. The phone
  is API 35, so this is the only place targetSdk 36 was actually exercised
  against a matching platform.
- **Item 8 — yes, it builds.** `react-native-background-actions@4.1.0` compiles
  and packages on this app's real stack: RN 0.83.2, New Architecture, AGP
  8.12.0, Gradle 9.0, compileSdk/targetSdk 36. `research/02` expected trouble
  from its `package=` manifest attribute and its `react-native:+` dependency;
  neither bit. **No fallback to the local Expo module is forced.** APK built and
  installed to the Zenfone 10.

### Two rig bugs found and fixed in place

1. **`hotspot.sh` could not have reproduced item 5 at all.** NetworkManager's
   hotspot mode is `ipv4.method=shared`, which NATs clients out through the
   box's default route — and this box has ethernet upstream. The phone would
   have had working internet over `ZeusSim`, validated the network, and the
   `interface: 'wifi'` trap would have stayed hidden. `up` now installs an nft
   table dropping forwarding on the AP interface and DNS to the box's dnsmasq,
   so the AP is as empty as the Zeus's. `SHARED=1` opts back out. `status`
   reports which mode is live.
2. **The 250 ms coalesce window is wall-clock, so Tier A would have measured
   nothing.** At the ticket's `--speed 60`, three hours of log arrives in three
   minutes and the window caps emission at 4 Hz — ~720 rows instead of ~10,800,
   i.e. a three-minute volume test wearing a three-hour label. The window is now
   configurable from the screen (0 ms for fast-forward), recorded per run in
   `spike_run.coalesce_ms`, and `report.mjs` refuses to call rows-per-second
   "coverage" on a fast-forwarded run.

### The environment, for whoever picks this up

Two toolchain traps, both unrelated to the spike, both now documented in the
spike README and fixed on this box: RN's Gradle plugin needs a **JDK 17
toolchain** which Gradle 9 cannot auto-provision (RN pins foojay-resolver 0.5.0,
which references the `JvmVendorSpec.IBM_SEMERU` Gradle 9 deleted), and **Gradle
must itself run on JDK 17** — on the system JDK 25 every CMake configure task
fails on a JEP 472 stderr warning AGP treats as an error.

Also worth knowing: **`adb reverse tcp:10110 tcp:10110` makes Tiers A and B need
no WiFi at all** — the phone reaches the desk simulator at `127.0.0.1:10110`
over USB. Only Tier C's item 5 needs the hotspot, because the whole point there
is which interface the socket binds to.

### A third rig bug, and an emulator trap

3. **The counters were module-scoped and carried across runs.** They feed the
   stored `run_stop` event, so a second run would have inherited the first's
   totals — the *recorded evidence* would have been wrong, not just the live
   display. Reset per run at the top of `captureTask`. Found before Tier B, so
   every number above is from a clean counter.

**The AVD will not boot with SwiftShader on this box.** The bundled
`gles_swiftshader/libGLESv2.so` segfaults the emulator ~7 s into guest boot, as
surfaceflinger comes up; `-accel off` dies in the same place, so it is the
renderer and not KVM. `-gpu host` boots in 20 s. Pinned in
`~/.android/avd/spike36.avd/config.ini` and written up in the spike README —
this cost most of an hour and is worth not paying twice.

### Session 4

Tier C run, on the phone, against the hotspot rig. Items 5, 6 and 7 answered;
in the process a fourth, unticketed problem surfaced that item 6 can't be
called closed without addressing.

- **Item 5 — PASS, with a wrinkle.** `interface: 'wifi'` OFF sometimes still
  connected — Android's routing decision under the no-internet trap isn't
  deterministic run to run. The fix (`interface: 'wifi'` ON) reliably works;
  that's what `11`'s reconnect logic depends on, so the finding stands.
- **Item 6 — the OEM freezer never touches the app.** Confirmed via logcat
  across ~90 min of combined runtime: `com.reddit.frontpage`,
  `app.revanced.android.youtube` and `com.linkedin.android` are frozen by name
  repeatedly; `com.loganmartlew.sailplan.dev` never once appears in a freeze
  line, and its two FGS starts (`Background started FGS: Allowed`) hold
  throughout. Auto-start Manager and per-app battery optimization were
  unchanged after the run. **But there is a real, reproducible user-facing
  consequence, and it isn't the OEM killer `02` was worried about**: a stock
  Android ANR fires on **resume**, not during background —
  `Input dispatching timed out ... waited 5000ms for FocusEvent` — logged 5s
  after the app's own `app_state → active` transition, with the "Not
  Responding" dialog reopening intermittently for ~3.5 minutes afterward.
- **Item 7 — PASS. ~6.9% for 34 min screen-on + 56 min background** (Settings'
  own per-app battery screen; the `dumpsys batterystats` figure pulled during
  the run turned out to be a since-last-reset, device-wide number, not
  per-app, and unusable). Light, linear, not a constraint.
- **A new, unticketed finding: samples thin under sustained real
  backgrounding, invisibly.** Two long runs, same rig, same host:

  | run | script | background span | rows | coverage | holes >3s |
  |---|---|---|---|---|---|
  | 15 | nasty (faulty) | ~19.5 min | 590 | 47.8% | 0 |
  | 17 | race (clean) | ~36 min | 620 | 27.4% | 0 |

  Run 17 used a fault-free script and thinned *worse*, over a *longer*
  background span — ruling out `nasty.json`'s scripted faults as the cause.
  Coverage drops but **no individual gap ever exceeds 3s**, so this is
  invisible to `report.mjs`'s hole detector and to `05`'s TTL-null staleness
  rule alike: a real session under this condition wouldn't show a gap in the
  app, it would just produce a thinner-than-expected polar. Leading
  hypothesis, not yet confirmed: socket `data` delivery to JS is deferred and
  delivered in bursts once backgrounded, and multiple anchors that in reality
  arrive a second apart land inside the same JS-processing burst, so `05`'s
  250ms coalesce window — keyed on `Date.now()` at *processing* time, not
  arrival time — silently collapses them. The same backlog is a plausible
  cause of the ANR above: a large enough catch-up burst on resume blocks the
  main thread past Android's 5s input-dispatch timeout. Both symptoms move
  together in the data (worse with longer background spans), consistent with
  one shared cause rather than two independent ones.

  This revisits `05`'s coalesce-window design, which the map already treated
  as settled — so it doesn't get a new ticket number; it stays inside `13`
  because the diagnosis needs the throwaway spike rig, not the real app, and
  `13` is where that rig lives until it's deleted.

### Next (diagnostic, not another blind run)

Don't repeat the ~30-minute unattended wait — the pattern is already
reproduced twice. What's missing is *why*, and that needs instrumentation,
not more duration:

1. **Log every raw socket `data` event**, not just anchors — timestamp and
   byte length, before line-splitting, in `spikeCapture.ts`. This directly
   shows whether `data` arrival itself goes bursty/sparse while backgrounded,
   independent of the anchor/coalesce logic downstream.
2. **Cross-reference against the existing `timer_heartbeat`/`timer_stall`
   events** (item 4's probe, already recorded). If the timer's stalls and the
   `data` event gaps move together, that's evidence both are gated by the same
   mechanism — plausibly the RN bridge's native→JS delivery being tied to the
   Choreographer frame loop, which item 4 already found pauses and stutters
   with the display off. If they *don't* move together, the cause is
   elsewhere (socket-buffer-level, not bridge-level).
3. **A short (10–15 min), tethered, screen-off run is enough** for 1 and 2 —
   this is about the mechanism, not battery or duration, so it doesn't need
   another genuinely-unplugged wait.
4. **If the bridge/Choreographer hypothesis holds**, check whether
   `react-native-tcp-socket`'s New Architecture path delivers `data` via JSI
   directly (bypassing the old bridge's frame-synced queue) or still goes
   through it — that decides whether the fix is a library/config choice or
   needs the local Expo module `02` held in reserve.
5. **Re-run the resume case with the same instrumentation**, logging queue
   depth or backlog size at the moment `app_state → active` fires, to check
   whether it scales with background duration (supports the backlog theory)
   or is roughly constant (points elsewhere).

Ticket stayed open, claimed, on this branch through session 5, which
superseded items 1–5 above — see "Session 5, continued" and after for what
actually resolved this thread, and the Answer for the final verdict.

### Session 5

Items 1 and 2 of the diagnostic list are AFK — pure instrumentation and
analysis code, no phone required. Items 3–5 need a human running a short
tethered screen-off session and are still open.

- **Item 1, done.** `spikeCapture.ts`'s `onData` now logs a `data_event`
  (`{bytes, gapMs}`) for every socket `data` chunk, before line-splitting —
  independent of the anchor/coalesce logic downstream, so it isolates whether
  the socket itself goes quiet.
- **Item 2, done.** `report.mjs` now computes `data_event` gaps against a
  `1500ms` threshold (below the sample-hole detector's 3s, on purpose — the
  thinning finding is exactly the case that detector misses), reports how many
  land within 1s of a `timer_stall`, and prints each gap with the byte size of
  the burst that follows it. Also added a "resume bursts" section: for every
  `app_state → active` transition, the next `data_event`'s size and gap —
  item 5's question (does the resume backlog scale with background duration)
  needs this logged before it can be answered, so this is prerequisite
  instrumentation for item 5, not item 5 itself.
- **Not done — needs the phone.** Item 3's short (10–15 min) tethered
  screen-off run, read afterwards with `node spike/report.mjs`: check whether
  `data_event` gaps correlate with `timer_stall`s (bridge/Choreographer
  hypothesis) or not (socket-buffer-level, elsewhere). Item 4 (New
  Architecture JSI vs bridge delivery for `react-native-tcp-socket`) is a code
  read, not a run, and is also still open. Item 5 needs a second run with a
  deliberately longer background span to see whether the resume burst size
  the new instrumentation reports scales with it.
- Not run against real hardware yet — `node --check` and `tsc --noEmit` are
  clean, but the actual `data_event` volume and its effect on the JS thread
  under a real burst is exactly what item 3 exists to observe, not something
  to infer from a clean typecheck.

### Session 5, continued — the "thinning" hypothesis was wrong

Logan ran the Tier C diagnostic (run 20, 849s, tethered, screen off) and
re-read it plus the existing run 17 with the new instrumentation. Both
falsified the leading hypothesis this ticket's "Next" section was written
against, and surfaced a sharper, more concerning one.

- **`report.mjs` gained two more views**, both derived from data already in
  `spike.db` — no new capture needed to get them: chunk byte-size (fg vs bg,
  from `data_event`), and a per-30-second-bucket activity histogram (sample
  count per bucket, `·` for "data arrived, nothing survived", blank for
  nothing logged at all). The histogram is the one that mattered — chunk size
  and the sentence-count-delta check (also added this session) came back
  unremarkable on their own, exactly as they would if the run were uniformly
  thinned, which is what made the histogram necessary to tell the two shapes
  apart.
- **The "invisible thinning" finding from session 4 was a misreading of an
  average.** Runs 17 and 20 aren't running at a sustained fraction of 1 Hz —
  each is **solid 1 Hz coverage for several minutes, then a hard cliff to
  total silence for the rest of the background span**, which never recovers,
  not even after the screen came back on (`resume bursts` shows no
  `data_event` after either resume). Run 17: alive ~630s, dead ~1634s. Run 20:
  alive ~300s, dead ~549s. The aggregate coverage percentage (27–32%) looked
  like uniform partial loss only because it averages a fully-alive window
  against a fully-dead one of comparable size.
- **This rules out both prior hypotheses.** Bridge/Choreographer batching
  would show large chunks or sentence-count spikes right where coverage drops
  — chunk sizes stay flat (fg 119B/max 513B vs bg 115B/max 487B on run 20) and
  sentence deltas show no spikes right up to the cliff, then nothing at all.
  There's nothing to batch or misparse if the socket stops receiving
  entirely — and it does: **no `socket_error`, no `socket_close`** fires at
  the death point in either run. The socket object is never told anything is
  wrong.
- **This matches something `research/02` considered and dismissed.** §5
  found the only functioning `WifiLock` mode (`WIFI_MODE_FULL_LOW_LATENCY`) is
  "only active when the screen is on," concluded WiFi power-save between
  beacons is "irrelevant for a 1–10 Hz NMEA stream... slightly bursty
  delivery," and dropped WifiLock from the design on that basis. That was a
  documentation-only prediction of *jitter*. What's measured on this phone is
  not jitter — it's a permanent cutoff after several minutes with no recorded
  error. If confirmed as a radio power-save escalation (rather than an OEM
  standby-bucket effect item 6 already cleared, or something else), `02`'s
  WifiLock dismissal was reasoning from the wrong magnitude of effect, and
  founding decision 6 needs that checked before it can stand as-is.
- **New: `spike/wifi-watch.sh`.** Polls `adb shell dumpsys wifi` on an
  interval throughout a run and greps for RSSI, link speed, supplicant state,
  power-save and screen-state lines, so the next repro can correlate the exact
  moment of death against what the radio was doing rather than inferring it
  from JS-side silence. Not yet run against hardware.

**Not done — needs one more phone run.** Repeat the Tier C protocol
(`interface: 'wifi'` ON, 250 ms window, ~10–15 min tethered screen-off is
enough given run 20 died at ~5 min) with `spike/wifi-watch.sh` running
alongside over adb, started when the app backgrounds. Read the capture with
`node spike/report.mjs` as before, and diff the histogram's cliff timestamp
against `wifi-watch.sh`'s log for the same moment. If the radio shows a power
mode or link-speed change right at the cliff, that's confirmation and the
fix path is a native WiFi lock (`WifiManager.WifiLock` at
`WIFI_MODE_FULL_LOW_LATENCY` or equivalent — despite `02`'s "screen must be on"
caveat, worth testing empirically whether it still helps while backgrounded,
since that caveat was reasoned from Javadoc, not measurement either) or
disabling WiFi power-save at the OS settings level as a fallback. If the radio
shows nothing unusual, the cause is elsewhere (OEM-specific, or something
`dumpsys wifi` doesn't surface) and needs a broader logcat capture around the
same window instead. Diagnostic items 3–5 as originally scoped are
superseded by this — items 1/2's instrumentation did its job, just not by
confirming the hypothesis it was built for.

### Session 5, run 21 — the cliff, pinned to the second, cause still open

Logan ran the Tier C repro a third time (run 21, 1135s — longer than
intended) with `spike/wifi-watch.sh` running alongside. Same shape as 17 and
20: solid 1 Hz for ~300s of background, then dead for the remaining ~830s,
never recovering, even after screen-on. This time the radio telemetry pins
the mechanism precisely:

- **`rx` (receive throughput) in the `CMD_ONESHOT_RSSI_POLL` lines craters
  from a steady ~14–24 to exactly `0.0` between 16:40:06 and 16:40:28** local
  — 284–306s after the app backgrounded (16:35:20) — and **stays at `0.0` for
  the remaining ~13.5 minutes**, matching `report.mjs`'s histogram cliff to
  within one 30s bucket.
- **The radio never disassociates.** RSSI stays healthy (-35 to -42) and the
  beacon counter (`bcn=`) keeps incrementing steadily the entire time. It is
  still receiving beacons and answering RSSI polls — it has simply stopped
  receiving the unicast NMEA data.
- **DTIM multiplier goes to 9 on screen-off** (`CMD_SET_MAX_DTIM_MULTIPLIER
  screen=off maximum multiplier=9`, at the same instant as
  `CMD_SCREEN_STATE_CHANGED screen=off`) — standard Android WiFi power-save
  listen-interval scaling. `02` predicted this produces "added latency of
  tens to low hundreds of milliseconds," not a multi-minute total cutoff, so
  DTIM scaling alone under-explains the size of the effect even though it's
  clearly involved in triggering *some* power-save state.
- **Checked this box's own logs for the same window — nothing.**
  `journalctl` (NetworkManager, kernel wifi driver) for 16:38–16:42 local is
  empty; routine AP-side power-save frame buffering isn't logged at INFO
  level, so this neither confirms nor rules out the AP (`hotspot.sh`, this
  box's own NetworkManager/hostapd) as the actual point of loss, as opposed
  to the phone's radio.
- **This is now the load-bearing open question**, not item 4/5 as originally
  scoped: is the drop happening on the phone's radio (would very likely also
  happen against the Zeus 3's own AP on the boat — a real problem for
  founding decision 6) or in this desk rig's Linux AP stack, freshly modified
  in session 4 for nftables isolation (would mean this specific failure mode
  is a rig artifact, not a finding about the feature). These have opposite
  implications for whether `02`'s "GATE PASSED, with caveats" verdict needs
  revisiting.
- **Next: a packet capture on the AP interface (`wlp9s0`), not another
  adb/dumpsys round.** If frames destined for the phone's MAC are still
  visible leaving the AP during the dead window, the phone is the one not
  receiving (radio-side). If the AP itself stops sending them, the loss is
  upstream of the radio (rig-side). This doesn't need the human beyond
  re-running the same short repro — the capture runs on the desk box.

### Session 5, run 23 — capture lost, but the run itself is a new data point

Logan re-ran the repro (run 23, labelled 23 not 22 — an earlier attempt was
restarted) with `sudo tcpdump -i wlp9s0 -w ... 'port 10110'` running
alongside, as asked. Two results, pulling in different directions:

- **The capture came back empty** — `/tmp/run22-ap-capture.pcap` is exactly
  24 bytes, the bare pcap header with zero packets, owned by the `tcpdump`
  system user (Fedora's tcpdump drops root after opening the capture — normal
  and unrelated). This is tcpdump's standard failure mode when the process is
  stopped by anything other than a clean `Ctrl-C` in its own terminal: the
  write buffer never flushes. **Not evidence of anything — the instruction
  given this session didn't specify `-U` (packet-buffered, flush-per-packet)
  or warn about the flush trap, so this is on the ask, not the execution.**
- **The run itself looks nothing like 17/20/21.** 690s wall clock, **82.8%
  coverage**, alive for essentially the whole ~681s background span with only
  the last 30–90s degrading — not the hard 5-minute-in cliff to total silence
  every prior real run showed.
- **Two live, un-distinguished hypotheses for why this run differed:**
  putting `wlp9s0` into promiscuous mode for the capture could plausibly
  change this box's AP-side driver/offload behaviour (would point at the
  rig, not the phone); equally, run 23 is simply a later run after several
  prior foreground-service sessions today, and Android's App Standby Bucket
  accounting considers usage history, so the app may have been promoted to a
  less-restricted bucket independently of anything on the desk box (would
  point at the phone, and make the earlier deaths a cold-start artifact
  rather than a steady-state one). No basis yet to prefer one over the other.
- **Not concluded — needs one more clean capture.** Same repro, tcpdump
  invocation fixed: `sudo tcpdump -i wlp9s0 -w <file> -U 'port 10110'` (`-U`
  flushes each packet as it's captured, so an ungraceful stop can't lose
  data) run for the file's whole lifetime, stopped with `Ctrl-C` in its own
  terminal once the phone side is done. If frames to the phone's MAC show up
  in the capture regardless of whether the run dies or stays healthy, that's
  the rig ruled out; if the capture is dense throughout a *healthy* run and
  would-be-thin during a repeat *dead* one, that's circumstantial support for
  the standby-bucket theory instead.

### Session 5, run 24 — the correlation, and the controlled test still owed

Run 24 (629s, tcpdump running with the `-U` fix) came back healthy again:
93.8% coverage, alive for essentially the whole ~620s background span. The
pcap (18,648 packets) confirms it independently of `report.mjs` — continuous
from the opening `SYN` to the closing `RST`, no gap. `wlp9s0` was back to
`promiscuity 0` immediately after tcpdump exited cleanly, confirming it *was*
in promiscuous mode for the capture's whole duration.

That makes the pattern across all six real Tier C runs today stark:

| runs | tcpdump on `wlp9s0` | outcome |
|---|---|---|
| 17, 20, 21 | not running | died hard at ~5 min, every time |
| 23, 24 | running | alive the whole span, both times |

3-for-3 dead without the capture, 2-for-2 alive with it — a strong
correlation, but not yet causation; it's equally consistent with a
time-of-day or Android-standby-bucket confound (session 5's run 23 note).
Logan chose to run the clean isolating test rather than write this up as a
hypothesis: one more repro, same protocol, **tcpdump not running this
time**. If it dies again, the rig is confirmed as the cause (or at minimum,
absolved of being the fix) and the desk-rig-artifact conclusion stands; if it
stays healthy, the correlation was coincidental and the cause is still open.

**Run 25 confirms it.** No tcpdump this time — 603s wall clock, **42.3%
coverage, solid for ~270s then dead for the remaining ~330s**, the same shape
as 17/20/21. Across all six real Tier C runs today: **dead in 4/4 without a
capture running on `wlp9s0` (17, 20, 21, 25), alive in 2/2 with one running
(23, 24)** — a clean A/B flip in both directions on the one variable
deliberately toggled. This is now a controlled result, not a coincidence:
whatever silences the socket tracks this desk rig's AP interface, not the
phone. The mechanism itself (why promiscuous mode on `wlp9s0` changes AP-side
delivery to a power-saving station) is still unknown and not worth chasing
further — `hotspot.sh` is a throwaway test rig, not the feature, and the
Zeus 3's own onboard AP hardware is a different stack entirely. This closes
the item 3–5 diagnostic: **founding decision 6 does not need revisiting on
the strength of this finding.** Confirming the desk-rig explanation
definitively (rather than merely making it the best-supported one) is a job
for `04`/`21` against the real boat AP, not for more runs against this rig.

## Answer

**All eight items answered. Founding decision 6 stands — a
`connectedDevice` foreground service, event-driven per `05`, is sufficient
for screen-off capture on this stack and this device.** No native Kotlin
tick, no local Expo module, no fallback needed.

| item | verdict | strongest tier |
|---|---|---|
| 1. FGS starts, `connectedDevice` not `dataSync` | **PASS** | observed, phone and API 36 AVD |
| 2. Socket survives genuine backgrounding | **PASS** | forced (Tier B) + observed (Tier C, 445s and multiple 10+ min real spans) |
| 3. Writes keep landing, counted | **PASS** | fast-forwarded (Tier A: 21,600/21,600, twice race volume in 336s) + observed (Tier C) |
| 4. `Choreographer`/timer with display off | answered, informational — no longer gates a design decision (`05` needs no tick) | observed |
| 5. `interface:'wifi'` fixes the no-internet trap | **PASS**, with a wrinkle (OFF is non-deterministic, not a clean fail; ON reliably works) | observed, Tier C |
| 6. OEM battery management | **PASS on the freezer question**; real risk was different (see below) | observed |
| 7. Battery cost over a race | **PASS** — ~6.9% for 34 min screen-on + 56 min background, light and linear | observed, genuinely unplugged |
| 8. Does RNBA build on this stack | **PASS** — RN 0.83.2, New Architecture, AGP 8.12.0, no fallback forced | observed |

**The stack that worked:** `react-native-background-actions@4.1.0` +
`react-native-tcp-socket`, socket opened inside the background task, capture
entirely event-driven off socket `data` (no JS timer on the path — the one
`setInterval` is item 4's probe only), batched SQLite writes, `interface:
'wifi'` pinned. `app.config.js` gained one config plugin
(`./plugins/withNmeaSpikeForegroundService`); the plugin merges
`android:foregroundServiceType="connectedDevice"` onto RNBA's own manifest
service and adds `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`,
`WAKE_LOCK`, `CHANGE_WIFI_STATE`, `ACCESS_NETWORK_STATE`,
`POST_NOTIFICATIONS` — the manifest diff is on this ticket's branch. Two
spike-only dependencies added (`react-native-background-actions`,
`react-native-tcp-socket`) — see [`spike/README.md`](../../../sailplan-app/spike/README.md)
for the port-to-real-feature checklist.

**What failed, and what it means:**

- **Nothing failed against founding decision 6 itself.** The multi-session
  "samples thin under sustained backgrounding" investigation (session 4's
  runs 15/17, most of session 5) turned out to be a **desk-rig artifact, not
  a phone or Android limitation.** Four real runs died hard at ~5 minutes
  in with no `socket_error`/`socket_close` (17, 20, 21, 25); the two runs
  where a packet capture happened to be running on the AP interface
  (`wlp9s0`, this box's own NetworkManager/hostapd hotspot) stayed healthy
  the whole span (23, 24) — a clean, controlled A/B result on toggling that
  one variable, confirmed by run 25 reproducing the death the moment the
  capture was removed again. RX throughput on the phone's own radio (via
  `dumpsys wifi`) craters to exactly `0.0` at the death point while RSSI and
  the beacon counter stay healthy — the radio never disassociates, it just
  stops receiving unicast data, for as long as this box's AP is left to its
  own devices. This is very likely specific to this desk rig's Linux AP
  stack, not something to expect from the Zeus 3's own onboard AP hardware —
  but that's the best-supported hypothesis, not a hardware-confirmed fact.
  **`04`/`21` should watch for the same shape (solid coverage, then a hard
  cliff to total silence with no error) against the real boat AP**, purely as
  a confirmation step; nothing about the app needs to change in response to
  this finding as it stands.
- **A real, separate, phone-side finding that does need carrying forward:** a
  stock Android ANR (`Input dispatching timed out … waited 5000ms for
  FocusEvent`) fires reproducibly on **resume**, 5s after the app's own
  `app_state → active`, with the dialog reopening intermittently for ~3.5
  minutes. Confirmed unrelated to the OEM freezer (this app never appears in
  a freeze line across ~90 min of combined runtime) and unrelated to the
  rig-side connectivity cutoff (found on a run where item 6 was otherwise
  clean). Not diagnosed further — this ticket's rig gave enough evidence to
  know it's real and reproducible, not enough to root-cause it. **Carry this
  into the real build as an implementation risk to watch on the resume path**
  (candidate causes not ruled out: RNBA's own resume handling, notification
  re-post, or a large `state` update from `spikeCapture`'s subscriber firing
  synchronously on resume) — it does not block founding decision 6 either,
  since `11`'s auto-end-and-resume design already treats a lost recording as
  a data gap, not a crash, but it's a rough edge worth fixing before ship.
- **Item 5's wrinkle**: `interface: 'wifi'` OFF sometimes still connected
  under the no-internet trap — Android's routing choice isn't deterministic
  run to run. Not a failure of the fix (ON reliably works, which is what
  `11`'s reconnect logic depends on), but means the trap can't be relied on
  to *demonstrate* the bug on demand, only the fix to prevent it.
- **A number for `11` to check against**: the no-route failure mode (wrong
  host, no listener) times out at **31s** (`ETIMEDOUT`), not a fast refusal —
  `11`'s reconnect ladder fires its first retry immediately, but detecting
  failure in the first place costs 31s on this stack.

**Two rig bugs and one emulator trap fixed in place**, documented in
[`spike/README.md`](../../../sailplan-app/spike/README.md) and
[`nmea-sim/hotspot.sh`](../../../nmea-sim/hotspot.sh): `hotspot.sh`'s default
NetworkManager mode NAT'd clients out through this box's own ethernet,
hiding the no-internet trap entirely, until `up` was changed to install an
isolating nft table; the 250ms coalesce window is wall-clock, so Tier A
needed a 0ms override or it silently measured a three-minute test wearing a
three-hour label; and the AVD needs `-gpu host` pinned or SwiftShader
segfaults ~7s into guest boot on this box.

The spike rig (`sailplan-app/spike/`, `plugins/withNmeaSpikeForegroundService.js`,
`app/spike.tsx`) is throwaway per its own README and can be deleted once the
real feature is built from `08`'s schema and this ticket's stack.
