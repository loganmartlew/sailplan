# Define the range-aware suggestion and navigation contract

Type: grilling
Status: resolved
Blocked by: 01, 02, 03

## Question

What domain types, evaluation boundary, range algorithm, result shape, plan
state, and navigation snapshot should express TWD uncertainty while preserving
the existing scalar sail-ranking engine and keeping single-leg suggestions out
of scope?

## Answer

TWD uncertainty is expressed as a **range walk over the existing scalar
engine**. `suggestSails` is not modified: every sample along the possible TWD
range is an ordinary scalar evaluation, and the new code decides only which
samples to take and what to conclude from them.

### The seam

`sailSuggestion` stays TWA-pure — it must not learn what a bearing or a
compass heading is. The geometry (folding a circular TWD range onto `0°–180°`
TWA) belongs to the coordinate/plan layer, which already owns `getTwa`; the
alternate policy from issue 01 (triggers, contiguity, side tie-breaks) belongs
to `sailSuggestion`, which already owns ranking.

```ts
interface RangeSample {
  twdOffset: number; // signed degrees from the central TWD; negative = lower side
  twa: number;       // folded TWA at that offset, whole degrees
}

function suggestSailsAcrossRange(
  samples: RangeSample[],
  tws: number,
  data: SailSuggestionData,
  config?: SuggestionConfig,
): RangeSailSuggestionResult;
```

The plan layer supplies the samples. Rejected: giving `sailSuggestion` a
`(twd, twdSpread, bearing)` signature, which inverts the current dependency
direction; and walking the range in the UI layer, which scatters issue 01's
policy into components.

### Geometry and validation

Add beside `getTwa` in `features/coordinate/util/bearing.ts`:

```ts
function getTwaRange(
  args: { twd: number; spread: number; bearing: number },
): { min: number; max: number };

function sampleTwdRange(
  args: { twd: number; spread: number; bearing: number },
): RangeSample[];
```

`getTwaRange` implements issue 02's folded interval
`[max(0, c - s), min(180, c + s)]`. Both assume an already-validated spread.

Validation gets a real schema, which the app currently lacks — `TrueWindInputCard`
validates ad hoc at `features/plan/components/TrueWindInputCard.tsx:21-31` and
`:45-59`. Add `trueWindSchema` in `features/plan/model/`: `twd` in `[0, 360)`,
`tws >= 0`, `twdSpread` in `[0, 40]` per issue 02. It is asserted at both the
**input** boundary (the wind card) and the **navigation** boundary
(`courseLegDataSchema` reuses the `twdSpread` bound).

### Sampling

A fixed **`1°` grid in TWD**, inclusive of both endpoints and of offset `0`.
Issue 01's "throughout a qualifying interval" is therefore a claim about
consecutive grid samples: an interval of width `w` degrees means `w + 1`
consecutive samples with the same winning sail, so the `5°` floor means **6
consecutive samples**. The specification must state this explicitly — the
continuous rule is verified discretely, and that is a deliberate, testable
approximation rather than an implementation detail.

Rejected: a `2°` grid (a minimum qualifying interval would rest on 3 samples),
and adaptive coarse-scan-plus-bisection (non-obvious, harder to test, and
unnecessary given the cost analysis below).

### Cost and caching

The course screen reads **one** TWD and **one** TWS for every leg
(`app/(plan)/course/plan.tsx:33-34`, `:152`). Legs differ only by bearing, so
they differ only in *which* integer TWAs they sample — and every sampled TWA is
an integer in `0°–180°`. The union across an entire course is therefore at most
**181** distinct TWAs. A ten-leg course at `±40°` costs at most `181 x sails`
evaluations, not `10 x 81 x sails` — about one leg's worth of work for the whole
course.

That is only realised if the memo is shared across legs, and each `CourseLegCard`
calls the hook independently. So the cache is a **private module-level**
`WeakMap<SailSuggestionData, Map<string, SailEvaluation[]>>` inside
`sailSuggestion`, with the inner key `` `${tws}:${twa}` ``. It must never be
exported; it is reachable only through `suggestSailsAcrossRange`.

The WeakMap key *is* the invalidation. The live queries in
`useSailSuggestionData` produce a new `SailSuggestionData` identity on any sail,
polar or limit edit, which drops the old cache to GC. Because the memoised
function is pure, a stale hit is impossible by construction and no explicit
invalidation logic exists. A test must assert that a fresh `SailSuggestionData`
identity yields fresh evaluations.

Rejected: a **precomputed table** (hash polars+limits, materialise all sails x
all TWAs x a TWS grid, invalidate on edit). It trades a correctness-critical
invalidation problem and megabytes of storage for a win the 181-TWA bound shows
we do not need. Recorded here so it is not relitigated; revisit only if
profiling on a real device contradicts the bound. Also rejected: prop-drilling
a cache from the course screen (pollutes two component signatures for the same
effect) and a per-leg memo (discards the cross-leg win).

### Result shape

The new type **embeds** today's result rather than replacing it, so
`SuggestionBreakdown` keeps its current prop and every existing consumer of
`SailSuggestionResult` is untouched.

```ts
type AlternateTrigger =
  | { kind: 'limit'; primaryBound: 'min' | 'max'; primaryLimitTwa: number }
  | { kind: 'speed'; speedAdvantage: number }; // fraction, e.g. 0.18

interface RangeAlternate {
  side: 'lower' | 'higher';          // side of the TWD range, not tack
  evaluation: RankedSailEvaluation;  // evaluated at the interval's midpoint
  twdInterval: { from: number; to: number };  // absolute TWD, may wrap 0/360
  twaInterval: { min: number; max: number };  // folded, for the leg-details band
  trigger: AlternateTrigger;
}

interface RangeSailSuggestionResult {
  central: SailSuggestionResult; // unchanged type, evaluated at the central TWD
  twdSpread: number;
  possibleTwa: { min: number; max: number };
  alternates: RangeAlternate[];  // 0-2, at most one per side
}
```

`alternates: []` is the "nothing qualified" case — there is no separate flag.
Issue 01's "no finite central leader" case needs no special handling either:
`central.suggested` is already empty and no alternate can qualify.

### Reason strings

The domain emits the structured `AlternateTrigger`; the **component** formats
the sentence (`Code 0 below its 85 degree minimum TWA`, `18% faster than
Genoa`). The app formats angles and speeds through `formatAngle`/`formatSpeed`
against `useSettings()`, so a domain-authored string would either bypass user
units or drag settings into a pure function. `AlternateTrigger` carries every
number the sentence needs.

### Consumer contract

`useSailSuggestions` has exactly two production callers —
`features/plan/components/CourseLegCard.tsx:115` and
`app/(plan)/course/leg.tsx:51` — and both become range-aware. A second hook
would leave the original as dead API surface, so the existing hook is **widened
in place**:

```ts
function useSailSuggestions(
  data: SailSuggestionData | null,
  leg: { bearing: number; twd: number; twdSpread: number; tws: number } | null,
): RangeSailSuggestionResult | null;
```

The scalar `(twa, tws)` parameters go away; the hook folds internally via
`sampleTwdRange`. Both callers already hold every field — `CourseLegCard`
computes `bearing` (it passes it into `legData` at `:121`), and the leg screen
gains `twd`/`twdSpread` from the widened snapshot below.

`suggestSails` itself is unchanged, keeping its ~30 test callers and
`features/sailSuggestion/eval/sweep.ts:79` working as they are.

**Uncertainty-off is the same code path, not a branch.** When
`twdUncertaintyEnabled` is false the hook is passed `twdSpread: 0`, which yields
exactly one sample, an empty `alternates`, and a `possibleTwa` collapsed to the
central TWA. Components render today's UI because `alternates` is empty — there
is no `if (enabled)` anywhere in the engine.

### Plan state

`PlanState` (`features/plan/store/planStore.ts:5-13`) gains two fields
alongside `twd`/`tws`:

```ts
interface PlanState {
  tws: number | null;
  twd: number | null;
  twdUncertaintyEnabled: boolean;
  twdSpread: number;
}
```

Two fields, not one: issue 03 requires the spread be **retained transiently**
when the toggle is off, which rules out encoding "off" as `twdSpread: null`.

State stays in the in-memory zustand store — no MMKV, no SQLite. "Transient per
boat profile" is precisely what `planStore` already is, and the store is shared
by both the course and single-leg planning flows, so the toggle and spread carry
across them for free. The initial `twdSpread` value for a profile that has never
enabled uncertainty remains unspecified here; it is tracked as fog on the map.

### Navigation snapshot

`courseLegDataSchema` (`features/plan/model/courseLegData.ts:3-29`) gains two
scalars, `twd` and `twdSpread`; `bearing` and `twa` stay as they are. The
leg-details screen re-derives the range result through the same
`useSailSuggestions` call the card used.

Rejected: serializing a computed `RangeSailSuggestionResult` into the route
param (pushes `RankedSailEvaluation` records, including `reasoning.pointsUsed`
arrays, through a URL, and risks a stale or truncated payload), and reading the
plan store directly on the leg screen (breaks the serialized-snapshot pattern
the plan README mandates for cross-screen objects).
