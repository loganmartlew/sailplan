# Manual tests — MT5, part one: the resume ANR

Covers ticket [`07`](../issues/07-spike-resume-anr.md), carried from device
spike [`13`](../../nmea-ingestion/issues/13-device-spike-background-capture.md)
as an implementation risk. Reviewed as part of **CR-B**.

> **Scope.** The execution plan's **MT5** gates `06` *and* `07`. `06` is not
> built, so the strip-on-nine-screens, two-tap stamping, undo toast and
> hold-to-stop items are not testable yet and are **not** in this document.
> This is the `07` half only — the ANR and the ten resume cycles. When `06`
> lands, its half joins MT5 as a sibling document and the checkpoint is ticked
> once both pass.

> **A claim of "passed" must say what was actually observed** — a resume count,
> an append time in ms, the exact logcat line. Record it in the results table at
> the end.

**This run also closes `04`'s two open hardware boxes** (the Doze/screen-off
race-length run, and the hotspot rig). `07` needs a race-length recording on
real hardware and so does `04`; that is one phone session, not two. **B1** is
`04`'s screen-off box and **B7** is its hotspot box.

## What is actually being asked

Spike `13` saw `Input dispatching timed out … waited 5000ms for FocusEvent`,
logged 5 s after the app's own `app_state → active`, with the "Not Responding"
dialog reopening intermittently for ~3.5 minutes afterward. It ruled out the OEM
freezer and the rig-side connectivity cutoff, and stopped there. Three candidate
causes were left open, and this build adds a fourth:

| # | Candidate | How this procedure decides it |
| --- | --- | --- |
| 1 | A resume burst of socket `data` blocking the main thread | **B4**'s per-resume data-event and byte counts |
| 2 | The synchronous raw-log append being the cost of that burst | **B4**'s total/worst append times |
| 3 | A backlog of the capture bar's 1 Hz JS timer landing on resume | **B4**'s timer-tick count |
| 4 | RNBA's own resume handling | **By elimination** — a quiet window in B4 with the ANR still firing (see B6) |

The notification re-post candidate `13` listed reads as already excluded:
`captureForegroundService.ts` posts once at start and never calls
`updateNotification`. **B5** confirms that on device rather than trusting it.

---

## 0. Preparation

### 0.1 The diagnostic build

`07`'s instrumentation
([`captureDiagnostics.ts`](../../../sailplan-app/features/capture/util/captureDiagnostics.ts))
is gated on `__DEV__`, so a development build has it and nothing else does.

```bash
cd sailplan-app && npm run android
```

Confirm it is live before committing to a long run — start any recording and
stop it, then:

```bash
adb logcat -d | grep capture-diag
#   -> [capture-diag] flush #1 (stop) session <n>
```

**No line means the rest of this document measures nothing.** Fix that first.

### 0.1a Metro must be reachable *over the hotspot*, not over home WiFi

The instrumentation only exists in a `__DEV__` build, and a `__DEV__` build is a
dev client that loads its JS bundle from Metro. `npm run android` points the
phone at this box's **home WiFi** address (`192.168.1.243:8081`) — which stops
existing the moment the phone joins `ZeusSim`. A dev build that cannot reach
Metro is a red error screen, not an app, and every test here needs a running app
for over an hour.

This works because Metro binds `0.0.0.0` and `hotspot.sh`'s isolation only drops
**forwarding** plus DNS on input — traffic to the box's own ports 8081 and 10110
is untouched. So after joining `ZeusSim`, reload the dev client against the AP
address that `hotspot.sh up` printed (`10.42.0.1` on this rig):

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "sailplan://expo-development-client/?url=http%3A%2F%2F10.42.0.1%3A8081"
```

Confirm the app actually renders before starting any recording. **Leave Metro
running for the whole session** — if Android tears the JS runtime down mid-run
it needs the bundle back.

A tempting shortcut that does not work: building `preview` or release to avoid
the Metro dependency. Those are not `__DEV__`, so `CAPTURE_DIAGNOSTICS_ENABLED`
is `false` and the run measures nothing.

### 0.2 A phone that can still reproduce the trap

For **B7** only (`04`'s box), and it is one-shot per SSID:

- the phone must have **working mobile data** — without it Android has nowhere
  else to route and the bug hides
- the phone must **not** have tapped *stay connected* for this SSID. That choice
  is sticky. **Forget the network to reset it**, and do that before B7, not
  after.

B1–B6 do not depend on this and can run over any working connection.

### 0.3 The rig

```bash
cd nmea-sim
sudo ./hotspot.sh up            # prints the address; SSID ZeusSim, pass sailplan123
node nmea-sim.js sail --script scripts/race.json --out logs/mt5.log
```

`sail` rather than `replay`: replay's log has no timestamps, so **any timing
conclusion drawn from it is worth nothing** — and timing is the entire point
here. `--out` keeps a replayable copy of exactly what the phone was sent.

Join the phone to `ZeusSim` and set the plotter address to the one `hotspot.sh
up` printed, port `10110`.

### 0.4 Logcat, and the cable problem

**B1 requires the phone genuinely unplugged, and that is not fussiness: Android
does not enter deep Doze while charging.** A USB-tethered run measures a
different power state than the one `13` found the bug in. But an unplugged phone
also means no `adb` over USB, so a `logcat` streaming to a file dies the moment
you unplug — taking the ANR line with it.

Resolve it by **enlarging the on-device log buffer and reading it back
afterwards**, rather than streaming:

```bash
PKG=com.loganmartlew.sailplan.dev
adb logcat -G 16M          # persists until reboot; default is far too small
                           # for a 60 min run and will silently wrap
adb logcat -c              # clear, immediately before starting the recording
```

Then after each reconnect:

```bash
adb logcat -d > ~/mt5-full.log
grep -E "capture-diag|ANR|Input dispatching|am_anr|Not Responding" ~/mt5-full.log \
  > ~/mt5-anr.log
```

This is the reason the diagnostics write a `.diag.jsonl` sidecar as well as a
logcat line — the file is on the phone's own disk and does not care whether
anything was listening.

**Do not skip `-G 16M`.** With the default buffer a busy hour wraps and the
resume you care about is gone.

**If you would rather watch it live**, `adb tcpip 5555` and connect over
`ZeusSim` (this box is the AP, so it can reach the phone even with the isolating
nft table up, which only drops forwarding). Accept that a live `adb` connection
keeps the radio and CPU busier than a pocketed phone, which is a mild but real
compromise of exactly the condition under test. Prefer it for B3, not B1.

---

## B1 — A race-length recording, screen off and pocketed (`04`)

**This is `04`'s open box, and every later test needs a live recording anyway.**

1. Start a recording from a course plan (`Record this course`).
2. Confirm the notification appears and the capture bar shows above the tab bar.
3. Screen off, phone in a pocket, **genuinely unplugged**. Leave it **60 minutes
   minimum** — the plan says race-length, and `13`'s effects got worse with
   longer background spans, so a short run is a weaker test, not an equivalent
   one.
4. Do **not** touch the phone during this. B2 is where resumes start.

**Expected:** after 60 min the recording is still running and the raw log has
grown continuously.

```bash
adb shell run-as $PKG ls -l files/capture/
```

**Watch for `13`'s rig artefact:** solid coverage, then a hard cliff to total
silence with no `socket_error` and no `socket_close`. `13` traced that to this
box's own Linux AP, not to the phone, and it stayed healthy whenever a packet
capture was running on the AP interface. If the log dies at ~5 minutes, run
`sudo tcpdump -i wlp9s0 -w /dev/null` alongside and try again before concluding
anything about the app.

---

## B2 — Characterising the ANR (`07`, boxes 1 and 2)

**The first checklist box: reproduce it and characterise the trigger.**

With B1's recording still live:

1. Take the phone out, wake it, unlock, and bring SailPlan to the foreground.
2. **Immediately try to interact** — tap a tab, scroll a screen. The ANR is an
   *input dispatch* timeout, so it needs pending input to fire. Sitting and
   watching a still screen can hide it.
3. Note by the clock what happens at ~5 s.
4. Whether or not the dialog appears, background the app again (Home). **That is
   what flushes the diagnostics** — flush deliberately never runs on `active`,
   so as not to add main-thread work to the window being measured.

**Expected (the bug):** the app is unresponsive for ~5 s and Android offers
*SailPlan isn't responding*. Record the exact logcat line:

```bash
grep -E "Input dispatching|am_anr" ~/mt5-anr.log
```

If it does **not** reproduce, do not conclude it is gone — `13` needed a
sustained background span first. Go back to B1 for another 30+ minutes before
treating a non-reproduction as real.

---

## B3 — Ten resume cycles inside one recording (`07`, box 4)

**The acceptance test.** One recording, ten cycles, no restart between them.

For each cycle: screen off → **wait at least 6 minutes** → wake → foreground the
app → interact immediately → background again.

The wait is not padding, and 6 minutes is not arbitrary. The desk baseline
(0.1's smoke test, on USB and home WiFi) measured **~1.6 ms per synchronous
append** at **~10 socket `data` events per second**:

```
611 data events, 73018 bytes, 966.5ms in synchronous appends   →  1.58 ms each
```

If the deferred-delivery hypothesis is right and a whole background span is
replayed into JS as one burst, crossing Android's 5 s input-dispatch timeout
needs roughly `5000 / 1.58 ≈ 3,200` events — about **5.4 minutes** of backlog at
this rate. Three-minute cycles would sit *under* the threshold and could produce
ten clean resumes that mean nothing. Six gives margin.

**This is extrapolation from a desk baseline, not a measurement — treat it as
the thing being tested, not a known quantity.** Two ways it could be wrong, both
worth watching for in B4:

- **The burst may be capped by the TCP receive buffer rather than by time.** At
  ~1160 bytes/s, a ~256 KB socket buffer holds only ~3.7 minutes of data before
  the window closes and the sender stalls — which would bound the burst near
  ~3,300 ms of appends, just under the threshold. That would explain an
  intermittent ANR better than a clean one, and `13` did describe the dialog
  reopening rather than firing once.
- **Doze may change the data rate or the per-append cost**, neither of which the
  desk baseline can predict.

If B3 comes up clean at 6 minutes, try two cycles at 15 before believing it.

Record for each cycle: did it hang, for how long, did the dialog appear.

| Cycle | Background span | Hang? | Dialog? |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |

**Pass is ten clean cycles.** This table is filled in twice — once before the
fix to establish the baseline, once after to claim the box.

---

## B4 — Reading the trace (`07`, box 2: root cause)

Stop the recording. Then:

```bash
grep -A6 "capture-diag" ~/mt5-anr.log
```

Each flush prints one line per resume:

```
  resume @1834.2s → 412 data events, 38104 bytes, appends 4820.5ms total / 61.3ms worst, 3 timer ticks
```

**Read it against the candidate table:**

- **`appends … total` approaching or exceeding 5000 ms** — candidates 1 and 2
  are confirmed together. The synchronous `file.write` per socket `data` event
  (`rawLog.ts:35`) *is* the blocked main thread. This is the expected result and
  the fix is to get the appends off the resume tick.
- **A large `data events` count but small `appends total`** — candidate 1 alone.
  The burst is real but the cost is elsewhere in the burst handling, not the
  file write.
- **A large `timer ticks` count** (more than ~2) — candidate 3 is contributing.
  `JavaTimerManager` stalled the capture bar's 1 Hz interval and delivered the
  backlog at once. Likely additive rather than sufficient on its own.
- **A quiet window — few events, sub-millisecond appends — with the ANR still in
  the logcat** — none of 1–3. See **B6**.

The full per-event trace, for anything the summary does not settle:

```bash
adb exec-out run-as $PKG cat files/capture/session-<n>.diag.jsonl > ~/mt5-diag.jsonl
jq -c 'select(.t=="appState")' ~/mt5-diag.jsonl          # every transition
jq -s 'map(select(.t=="data")) | max_by(.appendMs)' ~/mt5-diag.jsonl
```

Timestamps (`at`) are monotonic milliseconds from recording start; the flush
header's `wallClockOrigin` converts them to wall clock for lining up against the
ANR line in `~/mt5-full.log`.

---

## B5 — Ruling out the notification re-post

Reading `captureForegroundService.ts` says the notification is posted once and
never updated. Confirm on device:

```bash
grep -E "NotificationManager|enqueueNotification|NmeaCapture" ~/mt5-full.log \
  | head -40
```

**Expected:** posts clustered at recording start and at stop, **none** at the
resume timestamps from B4. A re-post landing on every resume moves this
candidate back onto the table.

---

## B6 — The elimination branch

Only if B4 shows a quiet resume window and the ANR still fires. That leaves
RNBA's own resume handling, which this instrumentation cannot see from JS.

1. Confirm the ANR needs a *recording* at all: repeat B2 with no recording
   running, after an equivalent background span. If it still ANRs, the cause is
   not in capture at all and this ticket is looking in the wrong place entirely.
2. Confirm it needs the *service*: `13`'s stack starts the FGS via
   `react-native-background-actions`. A run with the service started but the
   socket never connected separates library from transport.
3. Capture the main thread's stack at the moment of the ANR — Android writes it
   for you:

```bash
adb shell ls -l /data/anr/
adb exec-out run-as $PKG cat /data/anr/traces.txt > ~/mt5-anr-traces.txt 2>/dev/null \
  || adb shell "su -c 'cat /data/anr/traces.txt'" > ~/mt5-anr-traces.txt
```

The `main` thread's frames name the blocking call directly, and settle this
without further guessing. **This is the highest-value single artefact in the
document** — capture it even if B4 already looks conclusive.

---

## B7 — The hotspot rig and the no-internet trap (`04`)

`04`'s second open box. **Needs the fresh-install condition from 0.2** and is
one-shot per SSID.

1. Phone has mobile data on, and has never accepted *stay connected* for
   `ZeusSim`.
2. Join `ZeusSim`. Let Android's no-internet prompt appear. **Do not tap
   anything.**
3. Start a recording.

**Expected:** it connects anyway, because the socket is opened with
`interface: 'wifi'` — the mechanism, never a user-facing setting.

**Note `13`'s wrinkle:** with `interface: 'wifi'` *off*, Android's routing choice
was not deterministic run to run, so the trap cannot be relied on to
*demonstrate* the bug on demand — only the fix to prevent it. A pass here is
meaningful; a failure to reproduce the bug without the fix is not.

Also confirm the failure path, which needs no fresh install:

```bash
sudo ./hotspot.sh blackhole      # peer vanishes: packets dropped, no RST
```

**Expected:** a failed connect surfaces within ~31 s (`13` measured
`ETIMEDOUT`), the UI never looks hung, and **no** session row and **no** raw log
are left behind.

Neither this rig's Fedora box nor the test phone has an `sqlite3` binary, so the
`adb shell run-as … sqlite3` form used in
[checkpoint A](checkpoint-a-data-layer.md) does not work here. Pull and query
with Python's bundled `sqlite3` instead:

```bash
adb shell am force-stop $PKG          # checkpoint the WAL first
adb exec-out run-as $PKG cat files/SQLite/sailplan.db > /tmp/mt5.db
python3 -c "
import sqlite3
rows = sqlite3.connect('/tmp/mt5.db').execute(
    'SELECT id,status,rawLogPath FROM captureSession ORDER BY id DESC LIMIT 5'
).fetchall()
print(*rows, sep='\n')"

adb shell run-as $PKG ls -l files/capture/
```

Force-stopping is safe here — B7 is the last test and its recording is meant to
have failed. **Do not force-stop mid-B1/B3**; that ends the recording under test.
Drizzle Studio (wired up in `MigrationGate.tsx`, `shift+m` in the Expo terminal)
is the alternative if you would rather not stop the app at all.

---

## Results

### Run 1 — 2026-08-12, ASUS AI2302 (Android 15), forced Doze

The 60-minute unattended run was not available, so B1 was replaced by
**forced Doze** (`dumpsys battery unplug` + `dumpsys deviceidle force-idle`),
which lets the phone stay on USB and keeps `adb` alive throughout. Faster and
observable; **not identical to natural Doze** — no motion sensing, and
`force-idle` may skip maintenance windows.

| Test | Covers | Result | What was actually observed |
| --- | --- | --- | --- |
| B1 Doze survival, no exemption | `04` | **FAIL** | Socket destroyed at **2 m 43 s**. Per-minute data events `635, 624, 447, 0` — a cliff, not a taper. Process, `connectedDevice` FGS and notification all stayed up; UI showed a healthy timer for 35 min more |
| B1′ Doze survival, exemption granted | `04` | **PASS** | **13.7 min** steady, ~36 KB per 30 s throughout, largest inter-event gap **0.2 s**. Same rig, one variable changed |
| B2 ANR reproduced | `07` | **NOT REPRODUCED** | Two runs. Resume after 13.7 min in deep Doze opened instantly |
| B3 ten resume cycles | `07` | **NOT RUN** | Needs an unattended race-length run |
| B4 trace read | `07` | **PASS** | Resume window: 102 data events, 12,080 bytes, **141 ms** total appends, 2.14 ms worst, 10 timer ticks. Per-second `11,11,10,10,10,9,10,10,11,10` — **no burst**. 904 timer ticks in 908 s — **no stall** |
| B5 notification re-post | `07` | **EXCLUDED** | Posts only at start and stop |
| B6 elimination | `07` | **PARTIAL** | Candidates 1–3 excluded by measurement, not elimination. RNBA resume handling remains untested |
| B7 no-internet trap | `04` | **PASS** | Connected while the OS default route was mobile (`network{495} MOBILE[LTE] IS_VALIDATED`). Proven meaningful: `nc` from `adb shell` could not reach the AP at the same moment |
| B7′ failed connect | `04` | **PASS w/ bug** | ~30 s, three buttons, **no session row and no raw log left behind** (still 9 sessions). Copy was wrong — `ETIMEDOUT` misclassified as `refused`; fixed |
| — runtime FGS type | `04` | **PASS** | `types=0x00000010` = `FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE`, confirmed at runtime rather than only in the manifest |

**Headline:** the run found something more serious than the ANR it was written
for. The ANR is a hang on a recording that keeps working; the Doze socket death
is a recording that silently stops three minutes after the phone goes in a
pocket, with the UI still claiming everything is fine.

### Still owed

- Ten resume cycles inside one race-length recording (`07`, box 4)
- A **naturally** Doze'd run, to confirm the exemption finding outside
  `force-idle`
- Whether the exemption was actually granted cannot be read from JS — see
  `04`'s known gap

**Then:**

1. Write the root cause into `07`'s comments — box 2 asks for the finding, not
   just the fix, and box 5 says the cause matters for the rest of the service
   work. If it cannot be fixed, document the residual risk, the mitigation, and
   how the sailor recovers.
2. Delete `captureDiagnostics.ts` and its three call sites (each is commented
   `Throwaway, ticket 07`).
3. Tick `04`'s two hardware boxes and move it to `done`.
4. MT5 is **not** complete until `06`'s half also passes.
5. Run `/code-review` for **CR-B** across `03`, `04`, `07`, `12`.
