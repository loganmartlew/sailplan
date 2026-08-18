# 21 — Real-race replay harness

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §6.

**What to build:** An off-device loop that replays the **real** Saturday race log
through `replayCaptureSession` → `detectSailedLegs` and reports what it found, so
leg-detection defects are diagnosed in milliseconds on a laptop instead of by
rebuilding an APK and re-sailing. Leaves behind the repo's first real-race
regression fixture — everything before this was measured against the simulator.

**Blocked by:** nothing. Artifacts received 18 August 2026.

**Status:** done

## Why not copy the database across

The original instinct was to move the preview app's DB onto the dev app. Three
reasons it is the wrong loop, recorded so it is not re-proposed:

- **The raw log is already the evidence.** `replayCaptureSession.ts` reconstructs
  full samples from raw NMEA — including `lat`/`lon` from `RMC`/`GGA` — and
  `detectSailedLegs` is a pure function over those samples. Nothing about leg
  detection needs a database.
- **The preview APK is not debuggable.** `eas.json`'s `preview` profile is a
  release-type build, so `adb run-as` and backup extraction cannot reach its
  sandbox. Getting the DB across would mean building a dev-only import screen
  first — more work than the thing it is meant to debug.
- **The app already exports what is needed.** `shareRawLog()` in the raw log
  manager (ticket `12`) puts the log on any device.

The limit of the approach: a raw log carries no sail stamps, no session row and
no course. That is fine for leg **detection**; attribution work (`17`) would need
stamps supplied separately.

## Needed from Logan

- [x] Saturday's raw NMEA log, shared out of the preview app's raw log manager
      (`pending-1786754210467.nmea`, 9.9 MB, 12:36:44–14:51:34 NZST 15 Aug 2026).
      Logan confirmed 18 August 2026 that this is the right log for the race
- [x] The 7-leg course: read straight out of the dev app's `courseMark`/`mark`
      rows, where course "13 - 15/08" was replicated — no transcription needed
- [x] Which legs were actually sailed — **not needed in the end.** The log
      answers it: each mark's nearest pass falls in course order, 7–143 m, with
      the next-nearest decoy at 191 m. See the truth table below.

## Acceptance criteria

- [x] The log lands at
      `features/capture/util/__tests__/fixtures/saturday-race.log`, with the
      course beside it as a small JSON fixture — mirroring the existing
      `simulator-race.log` + `simulator-race.manifest.json` pair
- [x] A test replays the fixture and reports, per detected leg: start/end time,
      duration, median `|TWA|`, assigned name, and closest-approach distance to
      every course mark
- [x] The first run is **diagnostic, not assertive** — it exists to show which
      boundaries median-`|TWA|` missed and why, before anything is asserted
- [x] Once the truth is known, it becomes a regression fixture asserting the
      real leg count and boundary times within a stated tolerance — the truth is
      in the manifest, and `detectsTheSailedLegs` asserts against it. It
      currently records the **defect**; ticket `22` flips those numbers to the
      truth's
- [x] It runs under the normal `npm test`, not the opt-in eval config — this is
      a correctness test, not an accuracy sweep. Whole file: 3.7 s

## What was built

- `features/capture/util/__tests__/fixtures/saturday-race.log` — the plotter's
  bytes, untouched. `saturday-race.manifest.json` beside it: the 8 course marks
  with lat/lon, the 8 roundings, and the 7 sailed legs.
- `features/capture/util/rawLogReplay.ts` — `rawLogReplayInput(text)`. A real
  app log carries **no arrival times**: the recorder writes the plotter's bytes
  through with no `\s:…,c:…\` tag block, unlike `nmea-sim`'s logs. Replaying it
  on `assumedSentencePeriodMs` alone stretches this 2 h 15 m race over 7.5 h, at
  which point `MIN_LEG_MS`, `LEG_WINDOW_MS` and `DATA_GAP_MS` all measure line
  density instead of the clock. So timing is reconstructed from the GPS clock
  (`RMC`/`ZDA`), and sample timestamps land on real UTC — which is why the report
  below can name a boundary by the time it happened. Dropouts survive as gaps.
- `features/capture/util/__tests__/saturdayRaceReplay.test.ts` — the harness.
- `distanceMetres` is now exported from `reviewMapMarks.ts` rather than copied.

## The sailed truth, read off the log

Every fix against every mark, nearest pass per mark. Unambiguous — the eight fall
in course order, and no decoy comes close:

| # | mark | rounded (NZST) | distance |
|---|------|----------------|----------|
| 6 | Resolution | 12:41:54 | 20 m |
| 7 | North Head | 13:04:01 | 143 m |
| 8 | Salt Works | 13:15:54 | 7 m |
| 9 | North Head | 13:38:13 | 16 m |
| 10 | Salt Works | 13:51:14 | 10 m |
| 11 | Orakei | 14:20:05 | 38 m |
| 12 | Bayswater | 14:42:08 | 93 m |
| 13 | Westhaven | 14:49:32 | 112 m |

**One of those eight is not a rounding.** Logan, 18 August 2026: courseMark 7 —
the *first* North Head — was never a race mark. It is a **via point**, entered so
the course routes around the North Head peninsula on the way to Salt Works. The
boat passed it at 143 m because the headland forces that line. CourseMark 9, the
second North Head, is the race buoy. So the course is **7 legs as entered, 6 as
raced**: Resolution → Salt Works is one race leg that the via point splits in two.

The geometry above is unaffected — all eight passes are real and in course order —
but the distinction changes what `22` should aim at, and it is why the via-point /
additional-marks work on another branch matters here. See `22`.

Race 12:41:54 → 14:49:32; the recording runs 5 minutes before the start and 2
minutes past the finish. 8 023 samples over 2 h 14 m 49 s, every one with a fix,
5 data gaps over 5 s (longest 12 s), median TWS 14.7 kn, `VLW` rejected 8 027
times — the known malformed Navico sentence, and nothing else rejects at all.

Worth recording separately: the real stream classifies as **`water`**-referenced
wind. Every fixture until now left the frame `unknown`, so this is the first
evidence `classifyWindFrame` works on the boat's own instruments.

## What the harness found

**Nine legs, not four.** The pipeline off-device produces 9 legs from this log;
the phone reported 4 for what is very likely the same race. Same code, so the
difference is in the input: either the on-device session's samples are not what
this log replays to, or `materializeCaptureReview` ran over a partial session.
Worth a look while doing `22` — if the phone's stored samples disagree with the
log, that is a bigger defect than leg detection.

Truth against the nearest boundary median-`|TWA|` found:

| rounding | nearest detected boundary | off by |
|----------|---------------------------|--------|
| 12:41:54 Resolution | 12:41:30 | −24 s |
| 13:04:01 North Head | 12:54:46 | **−554 s — missed** |
| 13:15:54 Salt Works | 13:15:47 | −7 s |
| 13:38:13 North Head | 13:40:01 | +108 s |
| 13:51:14 Salt Works | 13:52:35 | +81 s |
| 14:20:05 Orakei | 14:43:23 | **+1 399 s — missed** |
| 14:42:08 Bayswater | 14:43:23 | +76 s |
| 14:49:32 Westhaven | 14:51:34 | **+122 s — missed** |

Every prediction in `22` is confirmed, with numbers:

- **Similar-`|TWA|` legs merge.** North Head#7 sits inside one 21-minute segment
  of median 157.8° — the run from Resolution through North Head to Salt Works is
  two legs at the same point of sail, and nothing separates them. Orakei#11 sits
  inside a 51-minute segment of median 45.2° covering Salt Works → Orakei →
  Bayswater: two beats, one segment.
- **The tail guard eats the finish.** The recording ran 2 minutes past Westhaven,
  which is inside `LEG_WINDOW_MS`, so no boundary can be found there at all.
- **Spurious boundaries before the start.** Two fired at 12:51:44 and 12:54:46,
  during pre-start manoeuvring. Because naming is positional, those two shift
  every later leg onto the wrong pair of marks — this is the misfiled data.
- **A ninth leg wraps the mark list** and invents "Westhaven → Resolution".

## Warning for `22`: greedy closest-approach does not reproduce the truth

The obvious reading of "closest approach after the previous rounding" fails on
this course, and the harness prints both so it cannot be missed:

```
Resolution#6   20m 12:41:54   ✓
North Head#7   16m 13:38:13   ✗ should be 143m 13:04:01
Salt Works#8   10m 13:51:14   ✗ should be   7m 13:15:54
North Head#9  153m 14:10:15   ✗ should be  16m 13:38:13
Salt Works#10 3424m 14:10:16  ✗ collapsed entirely
```

The first rounding of a mark is 143 m off; the second is 16 m. Greedy min steals
the later, closer pass for the earlier mark and every subsequent mark is dragged
forward — the same cascade as the `|TWA|` path, from the opposite direction. It
needs an assignment over the whole sequence (each mark's local minima, chosen so
the eight are monotonic in time), not a forward scan taking the global minimum.

Two more traps in the same data: the boat passes Resolution again at 191 m
(12:49:16, pre-start) and North Head at 153 m (14:10:15) while running the Salt
Works → Orakei leg. And a rounding radius guard has to admit 143 m without
admitting 191 m — the margin is thinner than the 2 km frame guard suggests.

## Comments

Raised 18 August 2026 after the first real race. The capture itself worked; the
review pipeline (`14`–`17`) showed **4 legs for a 7-leg race**, with sample data
not aligned to the legs it was filed under. Diagnosis in `22`.
