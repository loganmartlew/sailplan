# 14–17 — Implementation review

Reviewed 17 August 2026 against tickets
[`14`](../issues/14-sailed-legs-and-review-pager.md),
[`15`](../issues/15-span-editing.md),
[`16`](../issues/16-review-map.md),
[`17`](../issues/17-draft-attribution-from-stamps.md),
[`spec.md`](../../nmea-ingestion/spec.md) §§6–8, and the source at `HEAD`.

Fixed point: **`31515d0`** (`Move easignore file`), the commit before ticket 14's
work. 14 commits, 47 files, `git diff 31515d0...HEAD`.

Run as a two-axis review — **Standards** (does it follow the repo's documented
conventions?) and **Spec** (does it implement what the tickets asked for?) — in
parallel, so neither axis could mask the other.

## The one-sentence diagnosis

Every mechanical signal on this branch is green — `tsc` clean, lint 0 errors,
36 suites / 388 tests passing — and that is the risk: the two worst defects are
**invisible to the suite**, and the worst of them is invisible *because the
fixture is too well-behaved to resemble a real boat*.

## Verification baseline

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, 19 warnings — all pre-existing files outside this diff |
| `npx jest` | 36 suites, 388 tests, all passing |

---

## P0 — Must fix

**All six are fixed** — see [Resolution](#resolution-17-august-2026). The
findings are kept as written so the reasoning survives; the fix applied to each
is recorded at the end.

Ship-blockers: silent wrong results, data loss, or a crash. **Fix `1` before
anything else** — until it is fixed you cannot tell whether `4` and `5` are the
real behaviour or merely masked by it. All three live in the same attribution
path and should be fixed and re-verified as one batch against a jittered
fixture.

### 1. Steady-state detection is dead on real data

`steadyState.ts:117`

```ts
smoothed[end].timestamp - smoothed[start].timestamp + 1_000 === STEADY_MIN_MS
```

The `while` at :112 shrinks the window while `span + 1000 > 15000`, so it exits
with `span <= 14000`; the test then demands `span === 14000` **exactly**. That
holds only when every sample is spaced at exactly 1000 ms.

Live sample timestamps are not quantized. `replayCaptureSession.ts:342`:

```ts
sample.timestamp = Math.round(sessionStartWallClock + at);
```

`at` is wire-arrival time from `performance.now()` deltas. Nothing anywhere
rounds it to a 1 s grid. The reference fixture only passes because its log is
generated on exact 1 s boundaries.

Measured, with 60 samples of otherwise perfectly steady sailing:

| Cadence | Steady stretches found |
| ------- | ---------------------- |
| exact 1 Hz | 1 |
| ±7 ms arrival jitter | **0** |
| steady 1.1 Hz | **0** |

With no steady stretches, `proposeDraftAttribution` falls through to
`guardedSpans(leg, null)` (`draftAttribution.ts:319`) and **every leg of the
race comes back unattributed**, with no error and no warning. Ticket 17's entire
engine is inert on real boat data.

**Fix:** `>=` on the shrink-to-fit window. The one-character change is not the
work — the work is a regression test with jittered, non-1 Hz timestamps, so this
cannot silently come back.

### 2. `used` is derived, not stored — and toggling it destroys assignments

`SailedLegReviewPager.tsx:96-99`

```ts
setUsed(
  presentation.some(part => part.confirmedAt === null) ||
  presentation.some(part => part.sailSpans.some(span => span.sailId !== null)),
);
```

Two defects fall out of deriving a state that the sailor set explicitly:

1. A leg confirmed as **used** whose spans are all the default all-null guarded
   drafts (`createGuardedDraftSpans`) satisfies neither clause on revisit, so it
   re-opens reading **Not used** — contradicting user stories 60/61.
2. `spanPersistence.ts:30` writes `sailId: used ? span.sailId : null`. Toggling a
   leg off therefore **permanently destroys** the sail assignments, on a race
   that cannot be re-sailed.

**Fix:** persist the sailor's choice as a real column on `sailedLeg`; do not
infer it. Requires a migration.

### 3. Uncaught throw inside a render effect crashes the app

`captureReview.ts:66` throws `Error('Capture session not found')`.
`SailedLegReviewPager.tsx:52-58` calls `materializeCaptureReview(sessionId)`
directly in a `useEffect` body, so the rejection escapes uncaught: deleting a
session while its review screen is mounted takes the app down rather than
showing a message.

(The *synchronous heavy work* in the same function is a separate, lower-severity
finding — see P1.)

### 4. A stamp inside a transition still claims a region

`draftAttribution.ts:121-131`

`stampsOutsideTransitions` correctly guards `spansBetweenStampedSails` and
`stampSupportedSpansWithoutBoundary`, but `spansForOneStampedSail` instead
assigns a transition-interval stamp to the **nearest** region — which may be the
*old* regime. That attributes time to a sail that was not yet up.

Directly violates ticket 17's headline invariant — *"no sample is ever
attributed to a sail that was not up"* — and its *"Fails closed"* rule:

> The interval between the last qualifying stretch of the old regime and the
> first of the new is proposed **not used** — hoists, drops and manoeuvre
> transients feed neither sail

This is the class of defect that quietly poisons polar data downstream, which is
the entire reason the feature exists.

### 5. Unguarded division by median boat speed

`draftAttribution.ts:69-70` and `:298-299`

```ts
Math.abs(next.medianBoatSpeed - stretch.medianBoatSpeed) / stretch.medianBoatSpeed
```

A becalmed steady stretch (`stw` 0.0 — which `isSteady` is *happiest* with,
since `|s - 0| <= 0 * 0.05` holds) makes this `Infinity` at :69, so
`speedShift > 0.05` invents a **spurious sail-change boundary in a lull**. At
:299 the same divide yields `NaN`, and `NaN <= 0.05` is false, so `canCarry`
**silently refuses every legitimate carry-over** from a leg containing a lull.

Real on any light-air day. Two guard clauses.

### 6. The span editor loses its controls on page-turn

`SailedLegReviewPager.tsx:212` renders `<SailSpanEditor>` with **no `key`** —
unlike `ReviewTrackMap`, which is keyed by `leg.ordinal` at :202 — so selection
state survives a leg change. The clamp effect (`SailSpanEditor.tsx:76-83`) fires
only on `[spans.length]`.

Scenario: leg A has 5 blocks with block 3 selected; press *Next*; leg B also has
5 blocks but index 3 is a "No data" gap. `spans.length` is unchanged, so no
re-clamp runs, `selected` fails `isEditableSpan`, and the editor returns `null`.
The sailor gets a leg with a band and a map but **no controls at all**, and no
way to recover except paging away.

**Fix:** key the editor by leg, or include `spans` identity in the clamp.

---

## P1 — Should fix

**All fixed except `8`, which was withdrawn on evidence** — see
[Resolution](#resolution-17-august-2026).

Real, but neither silent nor destructive.

### 7. Leg fallback names use the wrong counter

`sailedLegDetection.ts:161` uses the global leg ordinal:

```ts
`${absTwa < 90 ? 'Beat' : 'Run'} ${ordinal}`
```

Spec §6 — *"With no course, legs fall back to `Beat 3 / Run 3`, renameable"* —
and user story 48 both mean **per-point-of-sail** counters: the 3rd beat and the
3rd run each read "3". The fixture instead yields `Beat 1, Run 2, Beat 3 … Run
20`, in which "Run 2" is the *first* run.

Promoted above cosmetic because `replayCaptureSession.test.ts:417-419` **asserts
the wrong numbering as correct**, so it will not self-correct later. Ticket 14's
box is ticked on the wrong behaviour.

### 8. Unmemoized arrays thrash the map camera

`SailedLegReviewPager.tsx:135-140` — `visibleSpans` and `allVisibleSpans` (and
`sailsQuery?.data ?? []` at :204) rebuild every render, feeding
`ReviewTrackMap.spans` → `coloredSpans` (:51) → `track` → `coordinates` →
`frameCoordinates` → `useEffect(frameTrack, [frameCoordinates])` (:101).

Typing in the leg-name `Input` at :179 therefore re-runs `buildReviewTrack` over
the whole session's samples and calls `fitToCoordinates` **per keystroke**.
`presentations` and `legSamples` were memoized; these two were missed.

### 9. Synchronous heavy work blocks the UI thread

`captureReview.ts:59-118` runs `detectSailedLegs` (a `slice` + `median` sort per
sample, `sailedLegDetection.ts:41-60`) plus `proposeDraftAttribution`
synchronously inside a blocking SQLite transaction, from a render effect. A
multi-hour session freezes on screen open with no spinner — the
`Preparing sailed legs…` guard at :114 covers only the live queries, which have
already resolved.

### 10. `stampSupportedSpansWithoutBoundary` asserts the opposite of what it does

`draftAttribution.ts:149` — the function takes `boundaries = []`, is called at
:197, :200 and :217 **with** boundaries, and uses them at :161-165 to compute
`regimeStart`/`regimeEnd`.

Ordinarily cosmetic; promoted because it sits in the module holding P0 `4` and
`5`, and a name that lies about a boundary parameter is precisely what makes
those defects hard to see. (`speedBoundaries` returning `{ oldEnd, newStart }`
at :75 is the same complaint, milder — "old"/"new" name nothing in the domain;
it is a transition window.)

### 11. `docs/data-layer.md:57` is now false

Still reads *"Schema only so far — nothing writes to them yet, so an empty
capture table is the normal state."* `materializeCaptureReview` and
`confirmSailedLegPresentation` now write `sailedLeg` and `sailSpan`. Only the
`captureSession` line was updated.

### 12. Requirements rewritten inside the diff — need a ruling

Both need a **decision**, not necessarily a code change:

- **Ticket 16's basemap criterion was reversed.** At `31515d0` it read *"**GPS
  only** — no chart tiles, no land"*; it now reads *"Standard road/land basemap
  behind the GPS track"*, matching `ReviewTrackMap.tsx:127`
  (`mapType='standard'`). But
  [`10-review-and-promotion-screen.md:164`](../../nmea-ingestion/issues/10-review-and-promotion-screen.md)
  still says *"The map is GPS-only: no chart, no land"*, and spec §8 was not
  amended either way.
- **Spec §8 was narrowed.** Was *"A block too short to hold a bin **says so**"*;
  now *"A block **carrying a sail** that is too short…"*, matching
  `spanEditing.ts:31-37` (`span.sailId !== null`). User story 55 is unchanged and
  still says *"a block too short to produce anything"*.

Defensible either way — but the sibling docs should stop contradicting each
other.

### 13. Ticket hygiene: boxes ticked for unbuilt work

- Ticket 17, *"Only **confirmed** spans can produce polar points"* — nothing
  gates on it. The only reads of `confirmedAt` are `captureReview.ts:154`,
  `SailedLegReviewPager.tsx:85,97` and `captureSession.ts:208`. No promotion
  consumer exists; that is ticket `18`.
- Ticket 14, *"the toggle beside its **point count**"* — `SailedLegReviewPager
  .tsx:189` shows the raw sample count. Ticket 15's Verification section already
  admits this and defers to `18`; ticket 14's box is still ticked.

### 14. `interface SailedLegReviewPagerProps`

`SailedLegReviewPager.tsx:42` uses an inline prop type.
[`docs/conventions.md`](../../../sailplan-app/docs/conventions.md) → *Components*:
*"Functional components, named exports, `interface XProps` for props."* Every
other new component in the diff (`SailSpanEditorProps`, `SpanTraceProps`,
`ReviewTrackMapProps`, `SailPickerSheetProps`) complies. A documented hard
violation, but a 30-second change with no behavioural risk.

---

## P2 — Not worth fixing now

- **Duplicated guard shape** — `sailedLegDetection.ts:115 createGuardedDraftSpans`
  and `draftAttribution.ts:25-64 guardedSpans`/`withGuards` must stay in lockstep
  with `LEG_HEAD_GUARD_MS`/`LEG_TAIL_GUARD_MS` with no shared call. The strongest
  of this pile; revisit **after** the P0 batch, which touches the same code.
- **Four near-identical span types** — `DetectedSailSpan`
  (`sailedLegDetection.ts:16`), `EditableSailSpan` (`spanEditing.ts:1`),
  `ReviewTrackSpan` (`reviewTrack.ts:10`), and the inline `regions`/`coloredSpans`
  shapes, with hand-written conversions at `SailedLegReviewPager.tsx:33-39` and
  `ReviewTrackMap.tsx:52-57`. A real Data Clump; a refactor with no user-visible
  payoff today.
- **Open-coded clamping** — `Math.min(Math.max(x, lo), hi)` ~9× in
  `draftAttribution.ts` (:48-49, :106-108, :166-176, :227-234). One
  `clampToInterior(leg, t)` would remove all of it.
- **Reshaping logic in the component** — `SailedLegReviewPager.tsx:25-40` and
  :72-80 reach into `legs.data` row internals. Belongs beside `useSailedLegReview`
  or in `util/`, where `docs/testing.md` also wants non-trivial decision logic so
  it is unit-testable. Promote if you end up writing tests around it.
- **`legBand.ts:16` latent corruption** — if two stored leg parts ever abut,
  `splitLegBand` (which splits only at gap blocks, padding with `[]` at :40)
  would give part 1 both parts' spans while `confirmSailedLegPresentation`
  (`captureReview.ts:146-152`) deletes part 2's rows and inserts nothing.
  Unreachable today: `continuation` (`sailedLegDetection.ts:146`) requires a
  `> DATA_GAP_MS` gap. Worth a one-line invariant assert if you are in the file.
- **`traceGeometry.ts:52`** — `Math.max(MIN_TOP_SPEED, ...speeds)` spreads the
  sample array as arguments. Will not reach the ~64k argument limit at realistic
  leg lengths.
- **Barrel export split** (`features/capture/index.ts:24-26`), **`~/features/sail`
  vs `~/features/sail/model/sail` inconsistency** (`SailSpanEditor.tsx:10` vs
  `SailPickerSheet.tsx:9`), **`api/` verb naming and `void` returns**
  (`captureReview.ts`, vs `docs/conventions.md`'s `createX`/`updateX` +
  `.returning()`) — cosmetic or explicitly defensible.
- **Course marks on the map** (`ReviewTrackMap.tsx:150-156`, `reviewMapMarks.ts`)
  — scope creep against ticket 16 and spec §8, which specify only the track, the
  per-span colours and the chip. Useful, tested, harmless: keep it, but record it
  in ticket 16 so it is not a surprise later.
- **`ReplayCaptureInput.spanEdits?: readonly unknown[]`**
  (`replayCaptureSession.ts:57`) — still an untyped placeholder while its two
  siblings were given real types.

### Withdrawn

`replayCaptureSession.ts:67`'s `draftSpans` was flagged as Speculative
Generality — a flattened duplicate of data already in `sailedLegs`, read only by
tests. **Withdrawn:** ticket 17 explicitly requires *"`replayCaptureSession`
extended to return `draftSpans`"*. The spec overrides the smell baseline.

---

## Resolution (17 August 2026)

The P0 batch is fixed. P1 and P2 are untouched and still open.

| # | Fix |
| - | --- |
| 1 | `steadyState.ts` — the sliding window now keeps `start` at the newest sample whose window still covers the minimum, so it grows to **at least** `STEADY_MIN_MS`. Note the naïve `===` → `>=` swap does **not** work: the `while` already forced `span <= 14000`, so `>=` would still only pass at exactly 15000. The loop condition had to move too. |
| 2 | New `sailedLeg.used` column (migration `0013`, plain `ALTER TABLE … ADD`, default `true`). `confirmSailedLegPresentation` writes it, the pager reads `leg.used` instead of inferring, and `sailSpanInsertsFor` **no longer takes `used` at all** — so striking a leg out can no longer erase sail assignments. Zod schemas in `model/capture.ts` updated to match. |
| 3 | `materializeCaptureReview` returns `boolean` instead of throwing; the pager renders a "Capture session not found" card. A missing row is an ordinary outcome from an effect, not an exception. |
| 4 | `spansForOneStampedSail` now filters its stamps through `stampsOutsideTransitions`, as the other two attribution paths already did. The nearest-region fallback remains for stamps in the head/tail guard, which are outside every region but inside no transition. |
| 5 | New `speedChangeRatio(from, to)` returns `null` when the ratio is undefined, and both call sites state their own conservative choice: an immeasurable shift **is** a boundary (propose a transition nobody sails through), and **is not** licence to carry a sail one hop. |
| 6 | `<SailSpanEditor>` keyed by `leg.ordinal`, matching `ReviewTrackMap`. |

### On fix 4 — the reading that was chosen

The ticket admits two readings for a stamp landing inside a transition, and they
give different behaviour. A stamp made mid-peel could be the sailor recording
the sail coming down *or* the one going up, so neither neighbouring regime is
safe to hand it to. Ticket 17 settles it — transients *"feed neither sail"*, and
the rule *"fails closed"* — so the stamp claims **nothing**. That also makes all
three attribution paths filter transition stamps identically, which they did not
before.

### Verification after the batch

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, same 19 pre-existing warnings |
| `npx jest` | 37 suites, 395 tests, all passing |

New `features/capture/util/__tests__/steadyState.test.ts` covers jittered
arrivals, non-1 Hz cadence, too-short runs, unsettled boat speed, and gap
splitting. It was checked against the pre-fix code and **fails 3 of 7 there**,
so it is not vacuous. `spanPersistence.test.ts`'s *"clears sails on a leg the
sailor marked not used"* asserted the destructive behaviour and was rewritten to
assert preservation.

### P1, fixed 17 August 2026

| # | Fix |
| - | --- |
| 7 | `sailedLegDetection.ts` counts beats and runs in their own sequences, so the third beat and the third run are each "3". Both tests that asserted the ordinal-based names were corrected, and a new case covers the spec's own `Beat 3 / Run 3` example. |
| 8 | **Withdrawn — not a defect.** See below. |
| 9 | Materialisation deferred behind `InteractionManager.runAfterInteractions`, with a `materializing` state so "Preparing sailed legs…" paints before the thread is taken. *Mitigation, not elimination:* the work is still synchronous once it starts. Chunking it, or moving it off the JS thread, is a separate job if long sessions still stutter. |
| 10 | `speedBoundaries` → `regimeTransitions`, its `{ oldEnd, newStart }` → `{ transitionStart, transitionEnd }`, and `stampSupportedSpansWithoutBoundary` → `stampSupportedSpans`. Both functions gained a doc comment saying what a transition *is*. |
| 11 | `docs/data-layer.md` now describes what actually writes to the capture tables, carries the `used` column, and corrects the `sailSpan` note: a null `sailId` is "unattributed", **not** "not used". |
| 12 | Ruled by the author: the basemap stays and `10-review-and-promotion-screen.md:164` was updated to match (a bare track gave no sense of place); §8's narrowing stands and story 55 was aligned to it. |
| 13 | Ticket 14's point-count box and ticket 17's confirmed-spans box unticked, each annotated with what is actually built and what `18` owns. |
| 14 | `interface SailedLegReviewPagerProps` extracted. |

### On finding 8 — withdrawn

The report was written against plain React semantics, in which `visibleSpans`
and `allVisibleSpans` rebuild every render and refire the map camera on each
keystroke. **This project has React Compiler enabled** (`app.config.js:70`), and
the compiler does not bail out on this component — compiling
`SailedLegReviewPager.tsx` with `babel-plugin-react-compiler` emits
`useMemoCache`, and the emitted code guards exactly these values:

```js
if ($[22] !== draftSpans || $[23] !== presentation || $[24] !== presentations) {
```

Typing in the leg-name field changes `name` alone, so none of those three
change, the cached arrays are returned, `ReviewTrackMap` sees a stable `spans`
prop, and `fitToCoordinates` does not refire. Adding manual `useMemo` here would
have been a no-op against the grain of a compiler-enabled codebase.

The general lesson for reviews of this repo: **do not report render-identity
findings without checking the compiler's output first.**

### Follow-on for ticket 18

Promotion must gate polar points on **`sailedLeg.used` and `confirmedAt`**. It
can no longer read a null `sailId` as "the sailor struck this leg out", because
spans now keep their assignments through a not-used toggle. See P1 `13`.

## Confirmed sound

- `sailSpans` relation exists at `schema.ts:318`.
- Migration `0012` is a plain `ALTER TABLE … ADD` — no FK-rebuild hazard per
  `docs/data-layer.md`.
- `spanPersistence.ts:26-31` names its columns rather than spreading the editable
  span, which does genuinely resolve the `UNIQUE constraint failed: sailSpan.id`
  that commit `4ce9824` claims. (Its `sailId: used ? … : null` line is a separate
  defect — P0 `2`.)
