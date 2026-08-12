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

2. Prepare one boat profile with a course and at least nine sails. The ninth
   sail proves that the two-column stamp picker scrolls; it does not need a
   polar. Configure the plotter endpoint with the host's LAN or hotspot address
   and TCP port `10110`.
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

| Build / commit | Device / Android | Simulator script / seed | Case | Result | Evidence path | Notes / defect |
| --- | --- | --- | --- | --- | --- | --- |
| | | | T05-1 | | | |
| | | | T05-2 | | | |
| | | | T05-3 | | | |
| | | | T06-1 | | | |
| | | | T06-2 | | | |
| | | | T06-3 | | | |
| | | | T08-1 | | | |
| | | | T08-2 | | | |
| | | | T08-3 | | | |
| | | | T08-4 | | | |

Record actual observed timings rather than just “passed”: last-anchor to loss
UI, each retry, each vibration, recovery, auto-end, sample count, and final
sample timestamp. This evidence is what distinguishes a real foreground-service
pass from a test that only succeeded while the app was open.
