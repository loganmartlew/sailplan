# Test plan — NMEA ingestion tickets 05, 06, and 08

## Purpose and exit rule

This plan closes the verification for:

- [05 — parse stream into capture samples](../issues/05-parse-stream-into-capture-samples.md);
- [06 — capture layer, strip, and sail stamps](../issues/06-capture-layer-strip-and-stamps.md); and
- [08 — connection loss, retry, auto-end, and resume](../issues/08-connection-loss-retry-auto-end-resume.md).

It follows the feature's [testing decisions](../../nmea-ingestion/spec.md#testing-decisions):
pure capture logic is proved at `replayCaptureSession`; socket, SQLite,
foreground-service, notification, vibration, and UI behaviour are proved on an
Android device. Do not mark `06` or `08` done until every hardware case marked
**Gate** has passed with retained evidence. A Jest pass is necessary evidence,
not a replacement for those checks.

To run this plan as an agent-driven session — who drives, which measurements
are instrument-backed rather than eyeballed, and where the run must pause for a
human verdict — see [GUIDE.md](GUIDE.md) and the helpers in `harness/`. This
plan remains the authority on what passes.

## Scope and traceability

| Ticket | Behaviour under test | Automated seam | Device gate |
| --- | --- | --- | --- |
| 05 | Parse/validate NMEA, coalesce one row per second, canonicalise units/datum, TTL-null stale fields, preserve gaps, classify wind frame | `replayCaptureSession.test.ts`; recorder tests for raw-first/session gating and queued writes | MT4: real 1 Hz persistence at 2× race volume and a stale field stored as `NULL` |
| 06 | Recording strip on every screen, reachability inset, two-tap timestamp-only sail stamp, undo, hold-to-stop, status notification | capture-layer-state and recorder/notification tests | MT5-06: all routes, one-handed strip/stamp/undo/stop, notification |
| 08 | Detect anchor silence/socket loss, retry ladder, finite alerts, retain one session and gap, auto-end, explicit resume | connection-loss-policy, capture-recorder, resume, and notification tests | MT6: screen-off loss/recovery, vibration timing, service shutdown at auto-end, resume |

The existing [MT5 ANR procedure](mt5-resume-anr.md) is a companion gate for
ticket 07. Run it as well when this is a full race-readiness check; this plan
does not duplicate its ten resume-cycle instrumentation.

## Test environment

Use a physical Android development build. An emulator cannot establish the
screen-off, foreground-service, notification, vibration, or unvalidated-Wi-Fi
behaviour this plan needs.

1. From `sailplan-app/`, build/install the development app:

   ```bash
   npm run android
   ```

2. Prepare one boat profile with a course and at least nine sails, **at least
   one of which has a polar** — T06-1 requires the `sails/[sailId]/polar-chart`
   route, which is unreachable otherwise (defect **P1**). Note that nine sails
   do **not** make the two-column stamp picker scroll on a 1080×2400 screen
   (defect **P2**). Configure the plotter endpoint with the host's LAN or
   hotspot address and TCP port `10110`.
3. Identify the installed package instead of assuming a variant:

   ```bash
   adb shell pm list packages com.loganmartlew.sailplan
   ```

   Set `PKG` in the following commands to that result (normally
   `com.loganmartlew.sailplan.dev`).
4. Start the deterministic simulator in a second terminal. `--out` retains the
   exact sent bytes for a failed-test replay; `logs/` is gitignored for this
   purpose.

   ```bash
   cd nmea-sim
   node test.js
   node nmea-sim.js sail --script scripts/nasty.json --out logs/t05-08-nasty.log
   ```

   `nasty.json` schedules split/concatenated writes, corruption, truncation,
   binary garbage, 90 seconds of stale `VHW`, status-`V` `MWV`, a 45-second
   silent-but-open feed, FIN/RST, and a 30-second plotter reboot. See the
   [simulator README](../../../nmea-sim/README.md#fault-injection) for the
   fault timing. Use `scripts/race.json` for a clean, repeatable long run.
5. Clear and enlarge logcat immediately before a device run. For screen-off
   testing, unplug afterwards: a charging phone does not enter the condition
   under test.

   ```bash
   adb logcat -G 16M
   adb logcat -c
   ```

6. For the no-internet Wi-Fi path only, use the hotspot rig. The phone must have
   working mobile data and must have forgotten `ZeusSim` if it has previously
   accepted Android's **stay connected** prompt.

   ```bash
   cd nmea-sim
   sudo ./hotspot.sh up
   node nmea-sim.js sail --script scripts/race.json --out logs/t05-08-race.log
   ```

## Automated regression suite

Run before each device session and attach the output to the result record:

```bash
cd sailplan-app
npx jest features/capture/util/__tests__/replayCaptureSession.test.ts \
  features/capture/util/__tests__/captureRecorder.test.ts \
  features/capture/model/__tests__/captureLayerState.test.ts \
  features/capture/model/__tests__/connectionLossPolicy.test.ts \
  features/capture/model/__tests__/captureResume.test.ts \
  features/capture/util/__tests__/captureNotifications.test.ts
npx jest
npm run lint
npx tsc --noEmit
```

The targeted suite is the test case record for the following otherwise
easy-to-regress invariants:

- `MWV,T` is distinguished by its flag, status `V` is rejected, malformed
  auxiliary fields do not discard wind, and malformed anchors do discard their
  row;
- TCP chunks are reassembled, over-length valid lines are counted rather than
  rejected, timestamps are whole epoch milliseconds, and no row is invented
  over a dropout;
- `VHW` held stale for 90 seconds yields 90 samples with `stw = NULL` and
  intact wind; the real GoFree fixture still records 142 rejected `VLW` and 331
  over-length lines;
- retries are `0, 1, 2, 5, 10, 15…` seconds; the default auto-end is 30
  minutes; only the 5-second loss alert and 60-second reminder are scheduled;
- recovery persists paired `lost`/`recovered` events in the same session, and
  auto-end stops at the final real sample without a gap row;
- an auto-ended session is resumable only while undismissed, unconfirmed, and
  not superseded by a newer recording.

Any targeted-test failure blocks device testing. If device testing fails, add a
minimal fixture to the appropriate pure suite before changing the production
path.

## Device tests

### T05-1 — Clean ingestion and persistence (**Gate**)

1. Generate 20 minutes of a timestamped clean race, replay it at 2× speed, then
   begin **Record this course**. This is the ticket's required 2× race-volume
   test, while the 750 ms emission floor should still retain about one row per
   second.

   ```bash
   cd nmea-sim
   node nmea-sim.js generate --script scripts/race.json --duration 1200 --out logs/t05-2x.log
   node nmea-sim.js replay logs/t05-2x.log --speed 2
   ```

   Let playback complete (about ten real minutes). It emits roughly 600 sample
   rows, not 1,200+; an unbounded 2 Hz row count indicates that the two anchors
   are being treated as independent samples.
2. Confirm live TWS/TWA update and the sample count rises at approximately one
   sample per second. Stop deliberately from the notification.
3. Inspect the completed session in Drizzle Studio, or pull/query the SQLite DB
   as described in the [data-layer checkpoint](checkpoint-a-data-layer.md#03-inspecting-the-device-database). Record the session id and run:

   ```sql
   SELECT COUNT(*) AS samples,
          MIN(timestamp) AS first_sample,
          MAX(timestamp) AS last_sample,
          SUM(tws IS NULL) AS null_tws,
          SUM(stw IS NULL) AS null_stw,
          COUNT(DISTINCT timestamp) AS distinct_timestamps
   FROM captureSample
   WHERE captureSessionId = <sessionId>;

   SELECT status, startedAt, endedAt, windFrame, healthCounters
   FROM captureSession WHERE id = <sessionId>;
   ```

**Pass:** `samples` and `distinct_timestamps` agree; duration and sample count
are consistent with about 1 Hz; timestamps are increasing epoch milliseconds;
the raw log exists; no retained sample has a derived tack/current-vector field;
all captured speeds are knots and true-north conversions reflect the simulator's
non-zero 21.5° E variation. A roughly 2.4 Hz result, duplicate timestamp, or
missing raw log is a fail.

### T05-2 — Fault-tolerant parsing and TTL-null (**Gate**)

1. Begin a fresh recording against `scripts/nasty.json` before its fault
   timeline reaches 60 seconds. Do not restart the app or simulator through the
   split, concat, corrupt, truncate, garbage, stale, status-`V`, and rate-drop
   windows.
2. At the stale window (570–660 s), verify live wind continues. After stopping,
   query the session:

   ```sql
   SELECT COUNT(*) AS stale_stw_rows
   FROM captureSample
   WHERE captureSessionId = <sessionId>
     AND timestamp >= <staleWindowStartEpochMs> + 3000
     AND timestamp < <staleWindowEndEpochMs>
     AND stw IS NULL AND tws IS NOT NULL;

   SELECT COUNT(*) AS false_zero_wind
   FROM captureSample
   WHERE captureSessionId = <sessionId>
     AND timestamp >= <statusVStartEpochMs>
     AND timestamp < <statusVEndEpochMs>
     AND (tws = 0 OR twa = 0);
   ```

3. Read `healthCounters` and retain the raw log. Replay the same raw artifact
   through the targeted Jest suite if diagnosis is needed.

**Pass:** after the TTL, the stale VHW interval has 90 `stw = NULL` samples
with non-null TWS; no status-`V` is turned into a false zero; corrupt/truncated
data increments health/reject evidence without poisoning later valid rows;
there is no field-shifted sample. A stale value forwarded into a later row is a
fail.

### T05-3 — Loss creates a discontinuity, not synthetic samples (**Gate**)

1. Leave the nasty run active through its 45-second `silence` interval, then
   its FIN/RST/reboot intervals; record the time each loss starts and recovers.
2. Query the resulting session:

   ```sql
   SELECT kind, at FROM connectionEvent
   WHERE captureSessionId = <sessionId> ORDER BY at;

   SELECT timestamp,
          timestamp - LAG(timestamp) OVER (ORDER BY timestamp) AS previous_gap_ms
   FROM captureSample
   WHERE captureSessionId = <sessionId>
   ORDER BY timestamp;
   ```

**Pass:** each recovered outage has a `lost` then `recovered` event; samples
are absent during the outage; an inter-row gap exceeds five seconds; and no
all-null marker row appears. The recovery remains in the same session.

### T06-1 — Capture layer visibility and reachability (**Gate**)

1. With a healthy recording, visit each required scrollable route:
   `(plan)/index`, `(plan)/course/plan`, `(plan)/course/leg`, `marks/index`,
   `courses/index`, `courses/courseGroups/[courseGroupId]`, `sails/index`,
   `sails/[sailId]/polar-chart`, and `sails/[sailId]/twa-limits`.
2. On every route, scroll to the final card/control. Capture a screenshot of
   the recording strip and the reachable final item.
3. Stop the recording. Revisit two representative long screens and confirm no
   strip, placeholder, or phantom bottom inset remains.

**Pass:** the strip is between content and tab bar on every route, never hides
the final content, shows a changing connection state/TWS/TWA, and disappears
completely when idle.

### T06-2 — One-handed, timestamp-only stamping (**Gate**)

1. Tap anywhere on the strip, then tap a sail: exactly two taps. Select the
   ninth sail to prove the picker scrolls, then repeat with a normal sail.
2. Confirm the strip presents each result as *last stamp* history and shows its
   age. Wait until it turns amber after 15 minutes in one long run (or perform
   that portion during T08-3's auto-end wait).
3. Immediately use Undo; wait more than about nine seconds after a second stamp
   and confirm the toast has expired. Query after each step:

   ```sql
   SELECT id, sailId, timestamp
   FROM sailStamp WHERE captureSessionId = <sessionId>
   ORDER BY timestamp;
   ```

**Pass:** each picker action produces one row with only session, sail, and
timestamp; Undo removes only the just-made stamp; the UI provides no way to
turn a sail off or create an interval; the last-stamp label never claims the
sail is current. A stamp must not be copied into samples or silently continued
by this layer.

### T06-3 — Stop and ongoing notification (**Gate**)

1. With a recording active, inspect the notification. Confirm it contains live
   TWS/TWA, sample count, and time since last stamp, but contains only **Stop**
   as an action.
2. Brush/tap/short-press the strip; it must not stop. Then hold the strip until
   the deliberate stop completes.

**Pass:** only a hold stops recording; the notification's Stop stops the same
session; no sail-stamping notification action exists; the final session is
`ended`, not `autoEnded`, and it has no resume offer.

### T08-1 — Visible loss, retry ladder, and finite vibration (**Gate**)

1. Start a recording with the phone unlocked. At the nasty script's 900-second
   open-but-silent interval, and again at its later socket-loss/reboot events,
   time from the last valid sample to the UI transition.
2. Record retry attempt times. The reboot is 30 seconds, long enough to observe
   `immediate, +1, +2, +5, +10, +15` seconds before recovery. If a retry
   connects too quickly to observe the ladder, stop the simulator for 35
   seconds and start it again on the same endpoint.
3. With the phone physically present, record vibration occurrences: one distinct
   alert near 5 seconds, one reminder near 60 seconds, no further reminder, and
   one short recovery confirmation.

**Pass:** loss is measured from the last valid anchor even while the TCP socket
is open; live values grey immediately, strip and notification say **Retrying**
with an increasing gap age; observed retries match the ladder; alerts occur
only at the specified thresholds; recovery restores live values without a new
session.

### T08-2 — Screen-off recovery (**Gate**)

1. Start a clean simulator recording, turn the phone screen off, then stop the
   simulator or use `sudo ./hotspot.sh blackhole` for at least 90 seconds.
   Restore/restart the source while the phone remains screen-off.
2. Wake the phone and inspect the strip, notification, raw log, sample count,
   and `connectionEvent` rows. Save logcat after reconnect:

   ```bash
   adb logcat -d > t08-screen-off.log
   ```

**Pass:** a foreground service remains active through the recoverable outage;
the phone reconnects to the configured Wi-Fi endpoint; the original session id
continues; events and sample discontinuity are retained; and no empty samples
fill the gap. A socket that stays connected but emits no anchors must take the
same loss path as a close event.

### T08-3 — Auto-end at the last valid sample (**Gate; 30-minute wait**)

1. Start a fresh recording and note its session id and most recent sample
   timestamp. Make the source unavailable using `hotspot.sh blackhole` or by
   stopping the simulator; do not restore it.
2. Keep the phone in the intended screen-off/foreground-service state for
   `AUTO_END_AFTER_MS` (currently 30 minutes) plus one minute. Note the final
   vibration and retain a screenshot of the final notification.
3. Query after auto-end:

   ```sql
   SELECT status, startedAt, endedAt FROM captureSession WHERE id = <sessionId>;
   SELECT MAX(timestamp) AS final_sample_at FROM captureSample
   WHERE captureSessionId = <sessionId>;
   SELECT kind, at FROM connectionEvent WHERE captureSessionId = <sessionId>
   ORDER BY at;
   ```

**Pass:** the service has stopped; notification reads **Recording ended —
plotter data lost**; session `status = 'autoEnded'`; `endedAt =
final_sample_at`; there is no sample after that timestamp; and the final alert
occurs once. A session ended at the timer time rather than the final sample is a
fail.

### T08-4 — Explicit resume and withdrawal of offer (**Gate**)

1. From T08-3, restore the simulator. Use **Resume recording** first from the
   auto-end notification, then repeat a separate auto-end case from the
   original course plan. Confirm it waits for a valid anchor before reopening.
2. Verify the session id is unchanged, the raw log grew rather than being
   replaced, a `recovered` event is added, and a later deliberate Stop advances
   `endedAt`.
3. In separate disposable sessions, verify each withdrawal rule: dismiss the
   offer; start another recording; and mark session data confirmed when that
   workflow is available. None may offer resume afterwards. Deliberately stop a
   healthy session and verify it never offers resume.

**Pass:** resume is explicit, starts no new session, preserves the outage,
requires valid data, and is offered only from the notification/original course
plan while the derived eligibility predicate remains true. It must never appear
in session history.

## Evidence and result record

Create one result record per build/device combination; do not overwrite a
failed run. Retain the simulator `--out` log, DB query output, screenshots,
and logcat beside the record (outside version control if they contain personal
race data).

Run record: `harness/evidence/542f53b-192-168-1-101-5555/run.md` (gitignored).

| Build / commit | Device / Android | Simulator script / seed | Case | Result | Evidence path | Notes / defect |
| --- | --- | --- | --- | --- | --- | --- |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json` generated 1200 s, replayed `--speed 2` (seed 1234) | T05-1 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — session 15, `pending-1786663321691.nmea` (1,581,561 B) | **600 samples / 599.03 s = 1.0017 Hz**; 600 distinct timestamps; 0 non-monotonic; gaps 845–1,159 ms; `null_tws`/`null_stw` = 0; health counters clean; `hdg` 158.5°M → **180.0°T** with `variation` 21.5 on every row; `stw` took 5.8 kn over 10.7 km/h; no tack/current columns. Replay server kept listening after EOF → phone reconnected for a 2nd pass (+56 rows); the 600 is bounded by the first `lost`. |
| `542f53b` | ASUS_AI2302 / Android 16 | `nasty.json` (seed 99) | T05-2 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — session 16, `pending-1786664549574.nmea` (1,902,242 B) | Post-TTL stale window **87/87 rows `stw IS NULL` with TWS non-null**; `stw` recovers within 10 s after the window (not forwarded); **`false_zero_wind` = 0**; **0 impossible values** session-wide (no field shift); rows after each corrupt/truncate/garbage window continue in range; `healthCounters` 66 over-length + ~900 rejects incl. binary-garbage keys. Fault-window epoch-ms literals in the run record. |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json` (seed 1234), outage induced manually | T05-3 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — session 17 | `lost` 1786666569710 → `recovered` 1786666666118 (**96.408 s**); **largest inter-row gap 96,409 ms**; 0 samples during outage; **0 all-null marker rows**; same session id. Two transient TCP connects mid-outage did **not** fragment it — still one `lost`/`recovered` pair. |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json` (clean feed) | T06-1 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — session 23; `t06-1-r1…r9-*.png` | All nine routes: strip between content and tab bar, final item **never** occluded — `(plan)/index` Plan button, `course/plan` last leg card, `course/leg` Screecher, `marks/index` WESTHAVEN of 26, `courses/index` 26, course group 23, `sails/index` SCREECHER of 9, `twa-limits` 30 kn row. Live state instrument-observed: green dot, TWS 10.5–13.5 kn, stamp age counting 2→14 min with the wall clock. Step 3 after stop: strip **absent from the hierarchy**, space reclaimed (STANLEY POINT now visible), **no phantom inset**. **`polar-chart` human-attested, no screenshot** — no sail had a polar (see P1). |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json` (clean feed) | T06-2 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — session 23, stamps id 2–5 | Two taps → one row, twice (Screecher `id=3` 14:59:49.6; Delta `id=4` 15:00:34). **Timestamp-only proved at the schema**: `sailStamp(id, captureSessionId, sailId, timestamp)` — no column can hold an interval; `captureSample` has **no sail column at all**. Undo **+3.1 s** removed only `id=5`, leaving 2/3/4; Undo **+27 s** did nothing. Picker exposes only `Stamp <sail>`×9 + `Close`, captioned *"records one instant only. It does not stay in force."* Strip reads `STAMP HISTORY / Screecher · just now`. One-handed confirmed by human. **Caveats:** nine sails fit one screen so **picker scrolling was not exercised** (see P2); amber transition only **bounded** (not amber +10 min, amber +20 min). |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json` (clean feed) | T06-3 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — sessions 23, 24 | Notification: `TWS 13.4 kn • TWA -179°` / `2,180 samples • Last stamp 3 min ago`, **`actions=1, [0] "Stop"`** and nothing else; count cross-checked against the DB (`COUNT(*)=2157` when it read `2,157 samples`). **Human's real thumb brush did not stop it**; 2500 ms hold did. Both stop paths verified: hold → session 23 `ended` 1786676825333; **notification Stop → session 24 `ended`** 1786677199823, **same session id, no new session**. Service gone and **0** notifications after each; no resume offer. `endedAt` − final sample +711/+935 ms, correct for a deliberate stop. **Observation:** a careless real brush opens the stamp picker (writes nothing without a second tap). |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json`, manual outages | T08-1 | **Pass** 2026-08-14 — with **D1 open** | `evidence/542f53b-192-168-1-101-5555/` — sessions 14, 16, 17; `t08-1-retry-ladder-syn.log` | **Ladder measured at packet level** (tcpdump SYNs to the closed port): **1.050 / 2.028 / 5.033 / 10.046 / 15.036 s**, first attempt immediate on socket close, then **caps at 15 s** (15.028, 15.041). Alerts across **four** outages: loss **+5.018 s**, reminder **+60.024 s**, then silent, recovery **+0.009 s** after `recovered`. Loss measured from **last valid anchor while the socket was still open**. Recovery in the **same session**; discontinuity 81,396 ms. **Defect D1 (open):** notification gap age pinned near "Gap 3 sec" while the strip correctly read "Gap 2 min 32 sec" — the "notification … increasing gap age" criterion is **not** met. Human elected to pass the gate and track D1 separately; **D1 must be fixed before `08` ships**. |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json` (seed 1234), phone **unplugged** | T08-2 | **Pass** 2026-08-14 | `evidence/542f53b-192-168-1-101-5555/` — session 18; `t08-screen-off.log` (17,314 lines) | Entire cycle ran **in doze, screen never woken**: `isForeground=true` mid-outage; alerts **fired in doze** at **+5.022 s** and **+60.010 s**; feed restored 13:03:22 and phone reconnected **while still dozing**. Session **18** continued; `lost` 1786669275510 → `recovered` 1786669402012 (126.5 s); **largest inter-row gap 126,502 ms**; **0** all-null rows. |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json`, source withheld; **real 30-min wait** | T08-3 | **Pass** 2026-08-14 — with **D2 open** | `evidence/542f53b-192-168-1-101-5555/` — session 19 | Final sample 1786669960645; auto-end fired 13:42:40.705 = **last sample + 30 min 0.06 s**. **`endedAt` = `final_sample_at` = 1786669960645, identical**; `status='autoEnded'`; **0** samples after; service stopped; notification **"Recording ended — plotter data lost"**. Loss alert +5.025 s, reminder +60.026 s, then silent 29 min. **Defect D2 (open):** the `autoEnded` haptic `[0,500,200,500,200,500]` was truncated at **831 ms of 1,900 ms** and overwritten by a foreign `[0,350,250,350]` buzz — `postCaptureAutoEndedNotification` posts with **no `channelId`**, landing on expo's fallback channel (`mVibrationEnabled=true`) instead of the app's `capture-recording` channel (`false`). |
| `542f53b` | ASUS_AI2302 / Android 16 | `race.json`; withdrawal rules used a temporarily shortened `AUTO_END_AFTER_MS` (**restored**) | T08-4 | **Pass** 2026-08-14 — with **D3 open** | `evidence/542f53b-192-168-1-101-5555/` — sessions 19–22 | Resume from the original course plan: **session 19 reused**, no new session; outage preserved (`lost` 1786669960647 → `recovered` 1786672784975); **raw log GREW 85,529 → 150,426 bytes**, same file. Withdrawal rules verified: deliberate stop (real 30-min constant), **`hasLaterSession`** (20 superseded by 21 while still `autoEnded`, `resumeDismissedAt` null), **dismiss via the notification action** (`resumeDismissedAt` 1786673884872), never in session history. **`hasConfirmedData` NOT tested** — that workflow does not exist in this build. **Defect D3 (open):** after resume the strip reads "No stamp yet" and the notification "No sail stamped" though `sailStamp id=1` persists — `adoptRecording` spreads `IDLE_STATE` (`lastStamp: null`) and passes `null` to the service. |

**Harness finding H1.** `nmea-sim` schedules a script's faults **per client
connection**, so `nasty.json`'s `silence` fault (+900 s) provokes the app's
correct reconnect, which restarts the fault timeline from zero. The faults after
it — `dropSocket` FIN (+1020), `reboot` (+1140), `dropSocket reset` (+1320) —
are therefore unreachable on any run length, and those cases must be induced
manually.

**Harness finding H2.** `adb input` is **silently dropped on a stale wireless
transport** while `screencap`, `dumpsys` and system-level key injection keep
working — so screenshots look healthy while every tap goes nowhere, and
`uiautomator dump` fails with `ERROR: could not get idle state.` This cost
~20 minutes of Session B. It appeared when the phone was plugged in mid-run,
leaving both a wireless and a USB transport attached; the same tap on the USB
transport landed immediately. If the phone gets plugged in, either
`adb disconnect <ip>:5555` or pin `ADB_SER` to the USB serial — and pin
`EVIDENCE` too, or `ui.sh` derives a second evidence directory from the new
serial and the run's evidence splits in two.

Separately, `uiautomator dump` fails mid-repaint **on a healthy transport** too,
because the strip repaints TWS/TWA about once a second (1 success in 3 bare
attempts). `harness/ui.sh` `dump()` now retries up to 8 times at 0.7 s; without
it every label-driven step fails for the whole of the T06 block.

### Precondition defects found in Session B

Two of this plan's own setup steps do not hold on the test device. Both were
found by T06 needing what the preconditions promised.

| # | Precondition as written | What is actually true | Fix |
| --- | --- | --- | --- |
| **P1** | "at least nine sails. The ninth sail … does not need a polar" | **No sail had a polar**, so `sails/[sailId]/polar-chart` — one of T06-1's own nine required routes — is **unreachable from a clean setup**. | Setup step 2 must read "nine sails, **at least one with a polar**". |
| **P2** | "The ninth sail proves that the two-column stamp picker scrolls" | All nine sails **fit on one screen** (1080×2400, density 440); Screecher renders as a full-width ninth tile and no scroll occurs. | Either raise the sail count until the picker actually scrolls, or drop the scrolling claim. T06-2's *reachability* of the last sail is still evidenced. |

### Open defects from the 2026-08-14 run

All three are recorded against passed gates by human decision; each must be
fixed before `06`/`08` ship.

| # | Defect | Where | Fix |
| --- | --- | --- | --- |
| **D1** | Notification's gap age is pinned near "Gap 3 sec" while the strip correctly counts up (measured simultaneously: strip "Gap 2 min 32 sec" vs notification "Gap 3 sec"). Fails T08-1's "notification … increasing gap age". | capture notification update path | — |
| **D2** | Auto-end haptic truncated at 831 ms of 1,900 ms and overwritten by the notification channel's default buzz. | `captureNotifications.ts` `postCaptureAutoEndedNotification` | Pass `channelId: 'capture-recording'` (or a dedicated channel with vibration disabled). Content-level `vibrate: []` cannot work — on Android O+ the **channel** governs. |
| **D3** | After resume, strip and notification claim no stamp though the `sailStamp` row persists. Breaks T06-2's last-stamp-with-age requirement for resumed sessions. | `captureRecordingStore.ts` `adoptRecording` | Rehydrate `lastStamp` from the resumed session instead of spreading `IDLE_STATE` and passing `null` to the service. |

### Usability issue U1 — hold-to-stop is not discoverable

Raised by the human during Session B and recorded in full against
[ticket 06](../issues/06-capture-layer-strip-and-stamps.md#u1--hold-to-stop-is-not-discoverable-2026-08-14-from-session-b).

**Not a gate failure** — hold-to-stop works exactly as ticket `06` specifies and
T06-3 passed on it. The acceptance criterion is what needs rethinking.

Nothing on screen tells a user that holding the strip stops the recording, and
the gesture they will try first — a tap — opens the sail stamp picker instead.
A user who does not already know about the hold has **no discoverable in-app
way to stop a recording**. The notification's **Stop** is the only labelled
path, and it is not in the app; on this device it sits in the shade's collapsed
silent section (`mImportance=2`, `pri=-2`), which took several attempts to reach
even while deliberately looking for it (see T06-3).

Any redesign must preserve the property the hold was chosen for and which this
run verified: a careless brush must not stop a recording.

**Also worth a look (not a defect yet):** a careless real brush of the strip
opens the sail stamp picker. It does not stop the recording and writes nothing
without a second deliberate tap, so T06-3 passes — but the strip's whole width
is the stamp target, so on the water a brush costs a picker dismissal.

**Also worth a look (not a defect yet):** T06-2's amber stamp age was only
**bounded**, not measured — not amber at +10 min, amber at +20 min, consistent
with the 15-minute threshold. Sampling the strip once a minute across the mark
would pin it.

**Also worth a look (not a defect yet):** one resume tap did nothing at all.
`resume()` returns early on `recording || isConnecting || courseId === null`
with no user-visible feedback; a second tap 90 s later worked. Unreproduced, but
a silent no-op on that button reads as an unresponsive app on the water.

### Instrument note — measuring the retry ladder

The GUIDE names the simulator's `accept` events as the ladder instrument, but
they **cannot** resolve it: with the plotter port closed — the real scenario —
every retry is refused at the TCP layer and only the successful reconnect
produces an `accept`. The app logs no retry attempts either
(`scheduleRetry` is silent, and `session-N.diag.jsonl` carries only
`data`/`timer`/`appState`/`flush`/`sessionStart`).

What works is host-side packet capture of the retry SYNs:

```bash
sudo setcap cap_net_raw,cap_net_admin=eip /usr/bin/tcpdump   # once; revert with setcap -r
tcpdump -i any -n -tt -l --immediate-mode \
  'tcp[tcpflags] & tcp-syn != 0 and tcp[tcpflags] & tcp-ack = 0 and dst port 10110 and src host <phone-ip>'
```

Inter-SYN gaps are the ladder. A "reject server" that accepts then immediately
closes does **not** work — a completed connect partially satisfies the app and
perturbs the timing.

Record actual observed timings rather than just “passed”: last-anchor to loss
UI, each retry, each vibration, recovery, auto-end, sample count, and final
sample timestamp. This evidence is what distinguishes a real foreground-service
pass from a test that only succeeded while the app was open.
