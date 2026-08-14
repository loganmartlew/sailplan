# Running the 05/06/08 test plan with an agent

This is the operating manual for driving
[`tickets-05-06-08-test-plan.md`](tickets-05-06-08-test-plan.md) as an
agent-plus-human session rather than as a script. **The plan is the authority.**
This file only says who does what, which measurements are trustworthy, and how
to hand the run to the next session. Where the two disagree, the plan wins and
this file is wrong.

## The division of labour

Three kinds of work, and the split is not negotiable:

**The agent drives.** Navigation, `adb`, SQL, evidence collection, the run log,
and the first-pass verdict on anything with a machine-readable answer.

**Instruments measure time — never the agent.** Every tool call is a round trip
of a hundred milliseconds or more, so an agent polling in a loop cannot resolve
the retry ladder's 1 s and 2 s rungs, and its "about five seconds" is worth
nothing as evidence. Three instruments carry every timing claim in the plan:

| Claim under test | Instrument |
| --- | --- |
| Retry ladder `0, 1, 2, 5, 10, 15` s | `accept` events in the simulator's `.events.jsonl` |
| Fault window boundaries (T05-2's epoch-ms literals) | `fault-start` / `fault-end` in the same file |
| 5 s loss alert, 60 s reminder, recovery buzz, auto-end alert | `./harness/ui.sh vibrations` (ms-stamped, attributed per package) |
| Sample cadence, gaps, `endedAt` | `captureSample.timestamp` in the database |

If a timing question has no instrument, it is a human observation — write down
what the human said, not what the agent inferred.

**The human judges what only a human can.** Reachability with one thumb,
whether a haptic *feels* distinct from another, whether a brush of the strip is
a realistic brush, and the final sign-off on every **Gate**. An agent may
propose a verdict from a screenshot; it may not record a Gate as passed on its
own authority.

## Preconditions

Already done (2026-08-14, commit `542f53b`) — verify, don't redo:

- **Simulator event log.** `nmea-sim` takes `--events FILE`, implied by `--out`
  as `<out>.events.jsonl`. JSONL, epoch-ms `t`, one object per
  `run-start`/`listening`/`accept`/`close`/`socket-error`/`reboot-down`/`reboot-up`/`fault-start`/`fault-end`.
  `node test.js` still passes (14/14).
- **`harness/db.sh`** — pulls the device DB with its WAL sidecars and queries it
  on the host. `./db.sh sessions` is the fastest "what just happened".
- **`harness/ui.sh`** — drives and reads the app by accessibility label.
- **Wireless adb** — `adb tcpip 5555` has been run; the phone answered on
  `192.168.1.101:5555`. This is what makes T08-2 and T08-3 possible at all: a
  phone on USB is a charging phone, and a charging phone is not in the condition
  those cases test.
- **Nine sails** exist on the device profile, so T06-2's scrolling picker
  precondition is met.

Check at the start of every session:

```bash
adb devices -l                      # expect the wireless transport
cd nmea-sim && node test.js         # 14 ok, ~40 s
cd sailplan-app && npx jest && npm run lint && npx tsc --noEmit
```

The plan makes a targeted-suite failure a hard block on device testing. Honour
that: if Jest is red, stop and report, do not "just check the device quickly".

If the phone's DHCP lease moved, re-pair over USB: `adb usb`, then
`adb tcpip 5555`, then `adb connect <new-ip>:5555`.

## Session shape

Run one block per agent session. Do not attempt all ten cases in one — the
`uiautomator` dumps and logcat will exhaust context somewhere around T08-1 and
the run will be lost mid-Gate.

**Session A — T05-1, T05-2, T05-3, T08-1** (~50 min, USB fine, phone plugged in).
One 20-minute `nasty.json` run covers T05-2, T05-3 and most of T08-1. Human
needed twice: a glance that live TWS/TWA are moving, and presence in the room
for the haptics.

**Session B — T06-1, T06-2, T06-3** (~25 min, highest interaction). The agent
navigates all nine routes and screenshots; the human rules on reachability and
on the brush-versus-hold distinction.

**Session C — T08-2, T08-3, T08-4** (~55 min, phone unplugged on wireless adb).
Mostly waiting. Background the waits, don't poll them.

## Recipes

All verified on this device (ASUS_AI2302, Android 16) on 2026-08-14.

```bash
cd .tickets/nmea-ingestion-build/manual-tests/harness

./ui.sh labels                       # what's on screen, by accessibility label
./ui.sh tap "Record this course"     # taps by label; ambiguity is an error
./ui.sh hold "Open sail stamp picker" 1500   # deliberate stop
./ui.sh brush "Open sail stamp picker"       # 50 ms — T06-3 says this must NOT stop
./ui.sh shot t06-1-sails-index       # screenshot into $EVIDENCE
./ui.sh notif                        # notification title/text/actions, unredacted
./ui.sh service                      # foreground service alive?
./ui.sh vibrations 10:31:00          # ms-stamped buzzes from this app

./db.sh sessions                     # recent sessions with sample/event/stamp counts
./db.sh q "SELECT ... FROM captureSample WHERE captureSessionId = 14;"
./db.sh logs                         # raw logs on device
./db.sh pull-log session-14.nmea     # retain one beside the record
```

Simulator, with the event log on:

```bash
cd nmea-sim
node nmea-sim.js sail --script scripts/nasty.json --out logs/t05-08-nasty.log
# → logs/t05-08-nasty.events.jsonl alongside it
```

Turning the event log into the plan's SQL literals — fault offsets are measured
from **client connect**, not from process start, which is why they can only be
read out of this file:

```bash
jq -r 'select(.event|startswith("fault"))|"\(.t) \(.event) \(.op) \(.sentences//"")"' \
  logs/t05-08-nasty.events.jsonl
```

The retry ladder, as inter-`accept` gaps in seconds:

```bash
jq -r 'select(.event=="accept").t' logs/t05-08-nasty.events.jsonl | \
  awk 'NR>1{printf "%.2f\n", ($1-p)/1000} {p=$1}'
```

Screen off, and back:

```bash
adb shell input keyevent 26          # screen off (phone must be UNPLUGGED)
adb shell input keyevent 224         # wake
```

Long waits (T08-3's 30 minutes) go in the background with a completion
notification, not in a polling loop. Poll at most once every few minutes if you
must, and never to measure anything.

## The pause protocol

Stop and ask the human — with `AskUserQuestion`, one question, concrete options
— at exactly these points:

1. **Before any Gate is recorded.** Present the collected evidence and the
   proposed verdict. The human answers pass/fail.
2. **T05-1 step 2 and T05-2 step 2** — is live TWS/TWA actually moving on
   screen, and does wind keep flowing through the stale window.
3. **T06-1, once per route** — batch these. Show the screenshots, ask about
   reachability and strip placement in one question covering all nine.
4. **T06-2 / T06-3** — one-handed operation, and that a real brush doesn't stop
   the recording. A synthetic 50 ms swipe is evidence about the code, not about
   a thumb.
5. **T08-1 step 3** — the human must be holding the phone. Ask them to report
   each buzz they feel; then reconcile against `ui.sh vibrations`. Disagreement
   between felt and logged is itself a finding worth recording.
6. **Anything that fails.** Do not debug past a failed Gate without saying so.

Everything else proceeds without asking.

## The run log

Append after **every** case, not at the end — this is what survives a context
compaction or a dropped session:

```
harness/evidence/<commit>-<serial>/run.md
```

One section per case: what was run, the observed timings, the SQL output, paths
to screenshots/logcat/raw logs, the human's verdict, and any defect. The plan's
result table wants *observed values*, not "passed" — last-anchor-to-loss-UI,
each retry, each vibration, recovery, auto-end, sample count, final sample
timestamp. Copy those into the plan's table at the end of the block.

`evidence/` is gitignored: a pulled device DB carries real race data.

A resumed session starts by reading `run.md` and continuing from the last
completed case. Never overwrite a failed run's record — the plan is explicit
that a failure is retained, not replaced.

## Rules that hold regardless

- **Do not shorten `AUTO_END_AFTER_MS`.** A 30-second auto-end proves the timer
  fires, not that a foreground service survives half an hour of screen-off doze,
  which is the actual risk T08-3 exists to catch. Wait the real 30 minutes.
- **Do not mark 06 or 08 done on a green Jest run.** The plan says a Jest pass
  is necessary evidence, not a replacement. Every **Gate** needs device
  evidence retained.
- **On a device failure, add a fixture to the pure suite before touching the
  production path** — the plan's instruction, and it keeps the regression where
  `replayCaptureSession` can see it forever.
- **Keep the raw log.** Several Pass criteria name it, and a failed run without
  the bytes that caused it cannot be diagnosed later.

## Known gotchas

- **`ui.sh vibrations` is unproven against this app.** The vibrator history is
  confirmed to carry ms timestamps and package attribution, but the app had not
  buzzed when the harness was built, so its records have never been seen. First
  thing in Session A: trigger one alert and confirm rows appear under
  `com.loganmartlew.sailplan.dev`. If they don't, fall back to human-reported
  timings and say so in the record.
- **`captureSample` has a unique index on `(captureSessionId, timestamp)`.**
  T05-1's "`samples` and `distinct_timestamps` agree" therefore cannot fail —
  the schema enforces it. The load-bearing part of that case is the *count*
  (~600, not 1,200+), so don't read the tautology as a pass.
- **Sessions 1–13 on this device have zero samples.** They predate the build
  installed 2026-08-14 10:25. Expect the first real session to be id 14; if a
  fresh recording also lands zero samples, that is the defect, not history.
- **`node test.js` failed once, unreproduced.** During harness setup one run of
  the simulator self-test reported `1 failing`; seven consecutive runs before
  and after were clean, and the failing case name was lost. The suite is
  timing-sensitive (it asserts ~10 Hz and ~1 Hz emission rates), so a loaded
  machine is the likely cause. Treat a lone failure as a re-run, a repeated one
  as a block — and capture the case name, which is what's missing here.
- **`hotspot.sh` needs sudo** and will prompt interactively. Ask the human to
  run it with `! sudo ./hotspot.sh up`. For plain socket loss, stopping the
  simulator is equivalent and scriptable; only the unvalidated-Wi-Fi path needs
  the rig.
- **Notification actions need the shade.** `cmd statusbar expand-notifications`,
  then `ui.sh labels` to find **Stop** or **Resume recording**. Collapse with
  `cmd statusbar collapse` afterwards or the next `uiautomator` dump reads the
  shade instead of the app.
- **`--out` truncates.** T08-4 checks that the *phone's* raw log grew across a
  resume; the simulator's own `--out` is a separate file and restarting the
  simulator replaces it. Use a fresh `--out` name per resume leg.
