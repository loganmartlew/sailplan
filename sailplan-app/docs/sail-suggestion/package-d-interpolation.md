# Package D — Interpolation upgrade (implementation plan)

> Covers finding **2.1** from [`improvements.md`](./improvements.md). Lives in
> the **`sailPolar`** feature, not `sailSuggestion`.
>
> **Deliberately last, and never bundled with Package A**: bilinear
> interpolation changes both predicted speeds *and* the confidence
> distribution; if it shipped with the scoring rewrite it would be impossible
> to tell which change moved the rankings. After A, the scenario table
> (`scenarios.test.ts`) doubles as the regression harness — if this package
> breaks a scenario, the interpolation is the cause by construction.

## Problem being solved

Polar data is inherently a grid (TWS columns × TWA rows — the `polars/`
generator emits exactly that), but `estimateSailSpeed` treats it as a
scattered point cloud and runs IDW (`k = 6`, `p = 2`, `twaScale = 0.25`,
`maxTwsDelta = 8`, `maxTwaDelta = 40`). Known pathologies on gridded data:

- **Plateaus at data points** — IDW can never predict above/below its
  neighbours, so it flattens the smooth speed curve between grid points and
  cannot extrapolate a trend.
- **Absurd search window** — 40° of TWA is admitted; at `twaScale = 0.25`
  that counts the same as 10 kn of TWS. Boat speed at TWA 60° vs 100° are
  different worlds.
- Prediction quality depends on **accidental point density**, not on whether
  the target is bracketed.
- Minor perf: `interpolateSpeed` recomputes distances `selectNearestPoints`
  already computed and threw away.

## Requirements

1. On regular-grid data, prediction at a grid node returns **exactly** the
   stored speed, and prediction between nodes is the **bilinear blend** of the
   four bracketing nodes (linear along each axis).
2. Genuinely scattered or partially gridded imports still work — IDW remains
   as the fallback path, unchanged in behaviour.
3. Confidence becomes primarily a **bracketing statement**: fully bracketed on
   both axes → high; clamped/edge-extrapolated on an axis → reduced in
   proportion to how far outside the grid the target sits.
4. Public API is preserved: `estimateSailSpeed(target, points, config?)`
   returns `InterpolationResult { predictedSpeed, confidence, pointsUsed }`.
   All existing callers (`evaluateSail`, any future ones) compile untouched.
5. A's scenario table stays green, except where a change is understood,
   justified by the physics, and the scenario is updated deliberately (record
   any such change in the PR description).

## Design

### Strategy selection

Extend `InterpolationConfig` (in `features/sailPolar/model/interpolation.ts`):

```ts
interface InterpolationConfig {
  // …existing IDW fields stay (they configure the fallback)…
  /** 'auto': bilinear when the data forms a usable grid, else IDW. */
  strategy: 'auto' | 'bilinear' | 'idw';   // default 'auto'
  /** Max gap (kn / °) between bracketing grid lines for bilinear to trust them. */
  maxTwsGap: number;   // e.g. 8  (mirrors maxTwsDelta)
  maxTwaGap: number;   // e.g. 20 (tighter than IDW's 40 — see minimal alternative)
}
```

`'idw'` preserves today's behaviour exactly (escape hatch + A/B testing in
tests); `suggestionConfig.interpolation` (from Package A) can override
per-caller.

### Grid detection & lookup — `util/polarGrid.ts` (new)

```ts
interface PolarGrid {
  /** Sorted unique TWS column values. */
  twsColumns: number[];
  /** Per column: rows sorted by TWA. */
  byTws: Map<number, { twa: number; speed: number }[]>;
}
buildPolarGrid(points: PolarPoint[]): PolarGrid
```

- Group points by exact `tws` value; sort columns and rows. (Float keys are
  fine: rows come from user input / the generator via SQLite and are compared
  by identity within one dataset, never across arithmetic.)
- The structure is cheap (O(n log n)) and built per `estimateSailSpeed` call,
  matching the current stateless design. If profiling ever shows it matters,
  the natural cache key is the `PolarPoint[]` array identity — but per-call is
  fine at fleet sizes (tens of points × ~10 sails), especially after Package B
  removed the per-card recomputation.

### Bilinear evaluation

For target `(tws, twa)`:

1. **Bracket TWS:** find columns `tws₀ ≤ tws ≤ tws₁`. If `tws` sits outside
   the column range but within `maxTwsDelta` of the nearest column, **clamp**
   to that column (degrades to 1-D TWA interpolation; confidence penalised).
   If the bracketing gap `tws₁ − tws₀ > maxTwsGap`, treat as not bracketed.
2. **Interpolate TWA within each bracketing column:** find rows
   `twa₀ ≤ twa ≤ twa₁` in that column, linear-interpolate speed. Same
   clamp-within-`maxTwaDelta` / gap-check (`maxTwaGap`) rules per column.
3. **Blend across columns** linearly in TWS:
   `speed = s₀ + (s₁ − s₀)·(tws − tws₀)/(tws₁ − tws₀)`.
4. `pointsUsed` = the 2–4 grid nodes consulted (the UI/reasoning contract is
   unchanged: "which measurements produced this number").

**Auto fallback rule (strategy `'auto'`):** if either bracketing column fails
to bracket/clamp the TWA (fewer than 2 usable nodes overall), fall back to
the existing IDW path for that target. This handles ragged grids (columns
with different TWA rows) per-query, without a global "is it a grid" heuristic
— the grid attempt *is* the detection.

### Confidence model (bilinear path)

Replace the three-way weighted heuristic with per-axis factors, multiplied:

```
axisFactor = 1.0                      when bracketed (gap ≤ maxGap)
           = max(0, 1 − dist/maxDelta) when clamped to the nearest line
             (dist = how far outside the grid the target sits)
confidence = twsFactor × twaFactor × gapFactor
gapFactor  = penalises wide brackets: min(1, typicalGap/actualGap) per axis
             (typicalGap = median gap of that axis's grid lines)
```

- Fully bracketed inside a dense grid → 1.0 — which is what "the target sits
  inside four real measurements" deserves.
- The IDW fallback path keeps `computeConfidence` as is, so scattered-data
  confidence is unchanged.
- **Expected knock-on:** bilinear confidences will skew higher than IDW's on
  grid data. Package A's blend consumes raw confidence (`smoothstep(c, 0.25,
  0.70)`), so more sails will sit at `w ≈ 1` (pure polars). That is the
  *intended* effect — but it's exactly why this package is sequenced after
  A's calibration and validated against the scenario table.

### Perf ride-along (applies to the retained IDW path)

`selectNearestPoints` already computes each candidate's distance and discards
it; `interpolateSpeed` recomputes it. Change `selectNearestPoints` to return
`{ point, distance }[]` (or add a sibling that does) and have
`interpolateSpeed` consume the pairs. Both functions are exported — check for
external callers before changing signatures; if any exist, add the
pair-returning variant instead of breaking them.

## Minimal alternative (if bilinear is deferred)

Documented so the fallback decision stays cheap: keep IDW but

1. tighten `maxTwaDelta` 40° → **15–20°** (kills the worst cross-TWA
   contamination),
2. reuse computed distances (ride-along above).

This is a ~2-line-plus-tests change and can ship alone. It does **not** fix
the plateau/extrapolation defects — record it as a stopgap, not a resolution
of 2.1.

## Testing

New `features/sailPolar/util/__tests__/` cases (the feature's existing suites
continue to pin the IDW path):

| Case                                                                  | Asserts |
| --------------------------------------------------------------------- | ------- |
| Exact node recovery                                                    | grid-node target returns stored speed, confidence 1.0 |
| Midpoint linearity                                                     | target centred in a cell returns the mean of the 4 corners |
| Axis linearity                                                         | sweeping TWA between two rows is monotone/linear for linear data (kills the IDW plateau) |
| TWS clamp                                                              | target just outside the last column uses 1-D TWA interpolation with reduced confidence |
| Gap rejection                                                          | bracketing lines wider than `maxTwsGap`/`maxTwaGap` → fallback (auto) or low confidence |
| Ragged column fallback                                                 | column missing the TWA range → IDW fallback engages, result matches `strategy: 'idw'` |
| Scattered cloud                                                        | non-grid points behave identically to today (`'auto'` ≡ `'idw'`) |
| `pointsUsed` contract                                                  | contains exactly the consulted nodes |
| **Suggestion regression**                                              | `sailSuggestion`'s `scenarios.test.ts` green with `'auto'` |

## Verification

- `npm run lint`, `npx tsc --noEmit`, `npx jest`.
- On-device via the Package C breakdown sheet (this is why D comes last): the
  same legs/fleet used for C's verification, comparing predicted speeds and
  confidence tiers before/after — they should move in explainable directions
  (speeds smoother between grid points, confidence up on dense grids).

## Files touched

```
features/sailPolar/model/interpolation.ts     +strategy, +maxTwsGap/maxTwaGap
features/sailPolar/util/polarGrid.ts          NEW (grid build + bracket search)
features/sailPolar/util/interpolation.ts      bilinear path, auto-fallback, distance reuse
features/sailPolar/util/__tests__/            new suites above
features/sailPolar/README.md                  interpolation + confidence docs rewritten
features/sailSuggestion/README.md             pipeline step 2 wording (IDW → bilinear/auto)
docs/domain-glossary.md                       only if it references IDW by name (check)
```

## Out of scope

Curve-fitting beyond linear (splines / physics-informed polar models),
persisting a prebuilt grid, editing the `polars/` generator, and any scoring
constant changes (if a scenario needs retuning, that's a deliberate,
documented follow-up in A's config — not part of this diff).
