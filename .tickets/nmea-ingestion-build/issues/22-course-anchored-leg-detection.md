# 22 — Course-anchored leg detection

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §6. User stories 45, 47.
Supersedes part of ticket [`14`](14-sailed-legs-and-review-pager.md).
Built on ticket [`21`](21-real-race-replay-harness.md), which is **done**.

**What to build:** When a course is linked, derive leg boundaries from **where
the boat actually was relative to the known marks**, not from the shape of the
`|TWA|` trace. A course with 7 legs yields 7 legs by construction, and leg *i* is
named for marks *i* → *i+1* because that is where the boat physically went.

**Blocked by:** nothing.

**Status:** done

---

## Start here

Everything needed to work this ticket is off-device and committed. There is no
phone, no APK and no re-sail in the loop:

```bash
cd sailplan-app
npx jest features/capture/util/__tests__/saturdayRaceReplay.test.ts   # 3 s
```

That replays a **real 2 h 15 m race** — Saturday 15 August 2026 on the Waitematā,
the first race ever captured with the app — through the actual pipeline and prints
a full diagnostic: per detected leg its start/end/duration/median `|TWA|`/name,
its closest approach to every course mark, the sailed truth against the nearest
boundary detection found, and what greedy closest-approach would have picked.

Read that output first. It is the whole problem statement in one page.

### Files that matter

| File | Role |
| --- | --- |
| `features/capture/util/sailedLegDetection.ts` | `detectSailedLegs` — the median-`|TWA|` segmenter to branch. Pure. |
| `features/capture/util/courseRoundingDetection.ts` | **To create.** The new course-anchored path. |
| `features/capture/util/rawLogReplay.ts` | `rawLogReplayInput(text)` — a real app log has no arrival times; this rebuilds them from the GPS clock. Always replay real logs through it. |
| `features/capture/util/reviewMapMarks.ts` | Exports `distanceMetres` (haversine). Measure with it; do not write a second one. |
| `features/capture/util/__tests__/fixtures/saturday-race.log` | The plotter's bytes, verbatim. 9.9 MB, 270 959 sentences. |
| `features/capture/util/__tests__/fixtures/saturday-race.manifest.json` | Course marks with lat/lon, the 8 roundings, the 7 sailed legs, and the via-point note. |
| `features/capture/util/__tests__/saturdayRaceReplay.test.ts` | The harness. `detectsTheSailedLegs` is the test to flip. |
| `features/capture/api/captureReview.ts` | `materializeCaptureReview` — the DB side. Needs changes; see below. |
| `features/capture/components/SailedLegReviewPager.tsx` | Review UI; where a re-detect action belongs. |
| `app/settings/capture-sessions/[sessionId].tsx` | The review route. |

---

## The defect

The first real race produced 4 legs for a 7-leg course, with the data misfiled
against the legs. Both symptoms are one cause: `sailedLegDetection.ts` never looks
at GPS or at mark positions. It segments purely on median `|TWA|` shifting ≥25°
over a ±90 s window, and uses the course **only** to name legs, positionally:

```ts
const from = courseMarks[(ordinal - 1) % courseMarks.length];
const to   = courseMarks[ordinal % courseMarks.length];
```

So a single missed boundary shifts every subsequent name. Undercounting does not
just lose legs — it misaligns everything after the first miss.

`21` measured why, on the real race. Off-device the same code finds **9** legs,
lands 5 of 8 roundings within two minutes, and misses three:

| rounding (NZST) | nearest boundary found | off by |
| --- | --- | --- |
| 12:41:54 Resolution | 12:41:30 | −24 s |
| 13:04:01 North Head | 12:54:46 | **−554 s — missed** |
| 13:15:54 Salt Works | 13:15:47 | −7 s |
| 13:38:13 North Head | 13:40:01 | +108 s |
| 13:51:14 Salt Works | 13:52:35 | +81 s |
| 14:20:05 Orakei | 14:43:23 | **+1 399 s — missed** |
| 14:42:08 Bayswater | 14:43:23 | +76 s |
| 14:49:32 Westhaven | 14:51:34 | **+122 s — missed** |

- **Consecutive legs at similar `|TWA|` merge** — the blind spot spec §6 names.
  North Head#7 sits inside one 21-minute segment of median 157.8° (two legs of run
  with nothing between them). Orakei#11 sits inside one 51-minute segment of
  median 45.2° covering Salt Works → Orakei → Bayswater: two beats, one segment.
- **`LEG_CHANGE_DEGREES = 25`** — close-hauled 40° to a tight reach 60° is 20° and
  never fires.
- **`MIN_LEG_MS = 180_000`** — a 7-leg race has short legs; under 3 minutes they
  are absorbed into a neighbour.
- **The full-`LEG_WINDOW_MS` guard** — no boundary can be found within 90 s of a
  data gap or of a session edge. The recording ran 2 minutes past the finish, so
  Westhaven cannot be found at all.
- **Two spurious boundaries** fire during pre-start manoeuvring (12:51:44,
  12:54:46). Because naming is positional, these two are what misfile every later
  leg, and they are why a ninth leg wraps the mark list into "Westhaven →
  Resolution".

The spec's measured "14/14 roundings, 0 spurious" was against the
windward-leeward simulator script, which is the geometry `|TWA|` handles best.

---

## The fixture and its truth

Course **"13 - 15/08"**, 8 marks / 7 legs, `courseId` 3 in the dev DB. `id` below
is the `courseMark` row id, which is what `detectSailedLegs` reports as
`courseMarkId`:

| id | mark | lat | lon | rounded (NZST) | distance |
| --- | --- | --- | --- | --- | --- |
| 6 | Resolution | −36.84433333 | 174.79816667 | 12:41:54 | 20 m |
| 7 | North Head | −36.82716667 | 174.818 | 13:04:01 | 143 m |
| 8 | Salt Works | −36.79666667 | 174.82266667 | 13:15:54 | 7 m |
| 9 | North Head | −36.82716667 | 174.818 | 13:38:13 | 16 m |
| 10 | Salt Works | −36.79666667 | 174.82266667 | 13:51:14 | 10 m |
| 11 | Orakei | −36.84233333 | 174.812 | 14:20:05 | 38 m |
| 12 | Bayswater | −36.82966667 | 174.76283333 | 14:42:08 | 93 m |
| 13 | Westhaven | −36.83166667 | 174.7485 | 14:49:32 | 112 m |

Times are NZST (UTC+12); the manifest stores UTC. Session runs 12:36:44 → 14:51:33
local, so the recording covers 5 minutes before the start and 2 minutes past the
finish. 8 023 samples, every one with a GPS fix, 5 data gaps over 5 s (longest
12 s), median TWS 14.7 kn, wind frame classifies as **`water`**. `VLW` rejects
8 027 times — the known malformed Navico sentence, and nothing else rejects.

The truth was read off the log itself (every fix against every mark, nearest pass
per mark) and Logan has **confirmed the log is the right one**. A test in the
harness, `grounds the manifest truth in the track`, re-derives it on every run, so
it cannot drift from the fixture.

**Two decoy passes** are what a naive detector trips on:

- Resolution again at **191 m, 12:49:16** — still manoeuvring before the start.
- North Head at **153 m, 14:10:15** — while running the Salt Works → Orakei leg.

---

## Via points change the target

Logan, 18 August 2026: **the first North Head (courseMark 7) was not a race
mark.** It is a *via point*, entered so the course routes around the North Head
peninsula on the way to Salt Works; the boat passed it at 143 m because the
headland forces that line. CourseMark 9, the second North Head, is the race buoy.
So this course is **7 legs as entered, 6 as raced** — Resolution → Salt Works is
one race leg that the via point splits in two.

The course model cannot yet tell the two apart. A via-points / additional-marks
feature is in progress on another branch. Given that, this ticket should:

- **Anchor on every course entry, via points included.** That yields 7 legs for a
  7-entry course, files every sample under the pair of marks it was sailed
  between, and splits one race leg in two — coherent, since the sailor entered
  that split and the two halves genuinely differ in point of sail. It is strictly
  better than today, where two legs merge and everything after is misnamed.
  **Do not try to guess which entries are via points.**
- **Keep the radius guard generous and let ordering do the work.** A via point is
  passed, not rounded: 143 m here, and easily 500 m on a course drawn to clear a
  headland with more margin. A radius tight enough to reject the 191 m pre-start
  decoy would also reject genuine via points. So the monotonic sequence
  constraint, not the radius, is what must reject decoys. Keep the radius as a
  sanity guard against a stale or mis-georeferenced mark — 500 m to 1 km — and let
  the assignment resolve the rest.
- **Leave raced-versus-entered to the via-points feature.** When that branch
  lands, review can group via-point-split legs into one race leg named from the
  race marks only. Follow-up ticket, not this one.

---

## The approach

New module `features/capture/util/courseRoundingDetection.ts`, built test-first,
pure over samples + marks-with-position. `detectSailedLegs` then branches: course
linked → rounding boundaries; no course → today's `|TWA|` path, untouched.

### Do not do it greedily

The obvious reading — "closest approach after the previous rounding" — fails on
this course, and the harness prints it every run so it cannot be missed:

```
Resolution#6    20m 12:41:54   ✓
North Head#7    16m 13:38:13   ✗ should be 143m 13:04:01
Salt Works#8    10m 13:51:14   ✗ should be   7m 13:15:54
North Head#9   153m 14:10:15   ✗ should be  16m 13:38:13
Salt Works#10 3424m 14:10:16   ✗ collapsed entirely
```

The first rounding of a mark is 143 m off and the second is 16 m, so a forward
scan taking the global minimum assigns the *second* pass to the *first* mark, and
every later mark is dragged forward until the fifth collapses — the same cascade
as the `|TWA|` path, from the opposite direction.

### Do it as a sequence assignment

- Per mark, find **local minima** of distance-to-mark along the track (each
  contiguous stretch inside the guard radius contributes its nearest point), not
  the single global minimum.
- Choose one candidate per mark such that all are **strictly increasing in time**
  and total distance is minimised — a small dynamic program over marks ×
  candidates. On this fixture that recovers all 8 roundings, because the correct
  assignment is the only monotonic one that keeps every mark inside the guard.
- **Per-mark fallback:** a mark with no surviving candidate (GPS gap, mark skipped,
  mark never approached) falls back to the median-`|TWA|` boundary in that window
  rather than dropping the leg.
- Measure with `distanceMetres` from `reviewMapMarks.ts`.
- Bound cost deliberately: 8 023 fixes × 8 marks is trivial, but a long session
  with a 20-mark course should still not be quadratic in fixes.

---

## Two prerequisites in the DB layer

Both are live defects found while writing `21`. Neither is optional — course
anchoring cannot work until they are fixed.

### 1. `materializeCaptureReview` does not read mark positions

`features/capture/api/captureReview.ts:88` selects only `{ id, name }`:

```ts
.select({ id: courseMark.id, name: mark.name })
```

There is no lat/lon anywhere in the review path, so `SailedLegCourseMark`
(`sailedLegDetection.ts`) has no position field either. Extend both — the type
needs `latitude`/`longitude`, and the query needs `mark.latitude` /
`mark.longitude`. The fixture manifest already carries marks in exactly the shape
the new type should have.

### 2. `courseMark.order` is all zeros on real courses

`materializeCaptureReview` orders marks by `asc(courseMark.order)`. On Saturday's
course **every `order` is 0**, so mark sequence currently falls out of SQLite's
arbitrary tiebreak. It happens to match insertion order today, which is why naming
looked plausible at all. Course anchoring depends on the sequence being right, so
this must be fixed properly.

Cause — `features/course/api/createCourse.ts:36`:

```ts
order = maxOrders[0]?.maxOrder ? maxOrders[0].maxOrder + 1 : 0;
```

A falsy check on a number: when the existing max order is `0`, the next mark also
gets `0`, and so does every mark after it. `CourseMarks.tsx:41` is the only caller
and never passes `order` explicitly, so **every course built through the UI is
affected**. (`courseId` 1 in the dev DB has a correct 0–4 sequence, so it predates
this or was seeded another way.)

- [x] Fix the falsy check (`?? -1`-style, so `0` counts as present)
- [x] Backfill existing `courseMark.order` from row id per course, via migration
- [x] Make read ordering deterministic anyway: order by `(order, id)`, so a
      zeroed course still comes out in insertion order rather than by luck

The fixture's mark order is by `courseMark.id`, and the track confirms it: the
eight roundings come out monotonic in time in exactly that order.

---

## Acceptance criteria

- [x] With a course linked, detected leg count equals the course's leg count
      whenever the track covers the course
- [x] Leg names come from the marks the boat actually rounded, not from ordinal
      position in the mark list
- [x] A mark rounded twice on a lap course resolves to two distinct roundings in
      the right time order — and specifically **not** greedily; a first pass 143 m
      out must not lose its rounding to a second pass 16 m out
- [x] A mark that is never approached within the guard radius does not claim a
      boundary; that leg falls back to `|TWA|` segmentation
- [x] Stale or mis-georeferenced marks cannot produce a boundary
- [x] Pre-start manoeuvring does not create a leg — the first leg starts at the
      first rounding, not at the first sample
- [x] A recording that runs past the finish still yields the finish boundary
- [x] With **no** course linked, behaviour is byte-for-byte unchanged
- [x] `21`'s real-race fixture asserts **7 legs with correct names and boundary
      times within ±60 s** of the manifest's truth. `detectsTheSailedLegs` in
      `saturdayRaceReplay.test.ts` currently records the *defect* — it is labelled
      `KNOWN BAD` and is the test to flip. Delete the recorded-defect expectations
      and assert `manifest.sailedLegs` instead
- [x] `grounds the manifest truth in the track` still passes untouched — if that
      breaks, the change broke replay, not detection
- [x] The existing simulator-race expectations still pass
      (`replayCaptureSession.test.ts`, `sailedLegDetection.test.ts`)
- [x] Whole suite stays green: 400 tests at the time of writing

---

## Re-detection is part of this ticket

`materializeCaptureReview` gates on `session.reviewMaterializedAt` and computes
legs exactly **once** (`captureReview.ts:78`). Without a reset path this fix
cannot reach a session that already exists on the phone — including Saturday's.

- [x] A "re-detect legs" action rebuilds a session's legs and spans
- [x] It discards unconfirmed drafts and warns before discarding **confirmed**
      legs — confirmation is the sailor's judgement, not a cache

---

## Spec change required

Spec §6 currently rejects GPS-based segmentation outright and records net-travel
bearing as the correct-but-unbuilt remedy (spec line ~1134). That rejection was
measured against the simulator's windward-leeward geometry. This ticket reverses
it for the course-linked case.

- [x] §6 updated to record the reversal and the evidence for it, so it is not
      re-litigated
- [x] §6 also records that the simulator's windward-leeward script is not
      representative geometry, and that `saturday-race.log` is now the reference

Note this does **not** resurrect the rejected approach. Net-travel bearing
inferred boundaries from track shape alone and produced 14 spurious boundaries;
this matches the track against **known** mark positions, which is a different
problem. The separate rejection of *inferring which mark* from rounding clusters
also stands — that was for the no-course case, where there is nothing to match
against.

---

## Open question, not blocking

Off-device the current code finds **9** legs from this log; the phone reported
**4** for the same race.

**Narrowed, 18 August 2026, still open.** The race was recorded on the **preview**
build, which is not debuggable, so its database cannot be read over adb and the
phone's 4 legs cannot be inspected directly. What was done instead: the raw log
was replayed off-device and its 8 023 samples written into the dev app's DB as a
session linked to course 3 — not a database copy, the evidence rebuilt from the
log, which is what `21` argues for. Opening it in the dev app before this ticket
landed produced **9 legs**, exactly what replay predicts.

So replay, the DB write path and `materializeCaptureReview` agree end to end, and
the discrepancy is in what the *preview* app had stored — its `captureSample`
rows, or a review materialised over a partial session — not in anything this
ticket touches. There is no evidence of a second recorder defect; there is also
no way to confirm one without a debuggable build of that variant. Left open.

---

## Comments

Decision taken 18 August 2026: anchor to the course's marks when one is linked,
rather than building the recorded net-bearing backstop or leaving detection as-is
behind manual boundary editing. Manual boundary editing remains worth having —
detection will never be perfect on real races — but as an escape hatch, not as
the fix. Not yet ticketed.

Via-point clarification from Logan the same day; see the section above.

## Outcome

Landed 18 August 2026.

- `features/capture/util/courseRoundingDetection.ts` — pure, one entry per mark,
  `null` for a mark never approached. Local minima per mark, then a dynamic
  program picking one per mark, strictly increasing in time at least total
  distance. Guard radius 750 m, pass separation 200 m. Cost is linear in fixes
  and bounded by candidates, not fixes.
- `detectSailedLegs` branches: with a course linked and positions to anchor to,
  boundaries come from the roundings; otherwise the `|TWA|` path runs unchanged.
  A mark with no rounding falls back to the strongest `|TWA|` boundary in the
  window its neighbours leave, and when the window offers fewer changes than
  there are marks missing from it, the legs merge rather than boundaries being
  invented.
- `legInterior` now scales its head/tail guards for a leg shorter than 35 s —
  `MIN_LEG_MS` no longer holds course-anchored legs apart.
- On the real race: **all 8 roundings within 1 s of the truth, 7 legs, correct
  names**. `detectsTheSailedLegs` now asserts `manifest.sailedLegs`.
- DB prerequisites: `createCourseMark`'s falsy check fixed, migration
  `0014_coursemark_order_backfill.sql` backfills `courseMark.order` from row id
  for any course whose orders are not already distinct, and reads order by
  `(order, id)`. The review query now selects `mark.latitude` / `mark.longitude`.
- `redetectCaptureReview` rebuilds a session's legs and spans; the review pager
  offers "Detect legs again" and warns first when confirmed legs would be lost.
- Suite: 412 tests green (was 400).

Two things Logan observed on the imported session that this ticket resolves by
construction, recorded because they were reported as separate symptoms: the first
few legs were pre-start (the first leg now starts at the first rounding), and an
eighth leg ran from the finish mark back to the start (positional naming wrapped
the mark list; N marks are now N-1 legs).
