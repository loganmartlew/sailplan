# Sail Polar Feature

Stores and reasons about **sail polars** — the performance data that says how
fast a boat goes at a given wind speed (TWS) and wind angle (TWA) with a given
sail. This feature owns polar CRUD, CSV import, the polar/scatter charts, and the
**interpolation engine** that the [sail suggestion pipeline](../sailSuggestion/README.md)
relies on.

See [`CONTEXT.md`](../../../CONTEXT.md#polars) for what a polar
is. The interpolation source ([`util/interpolation.ts`](util/interpolation.ts))
carries thorough JSDoc — this README is the map.

## Data model

A polar is many discrete `PolarPoint`s (`{ tws, twa, speed }`), stored in the
`sailPolar` table, one set per sail. `PolarPoint` is
`Pick<SailPolar, 'tws' | 'twa' | 'speed'>`.

## Interpolation (`util/interpolation.ts`)

Real conditions rarely land on a stored point, so boat speed is **estimated**.
Polar data is naturally a grid (TWS columns × TWA rows), so the primary path is
**bilinear grid interpolation**; **Inverse Distance Weighting (IDW)** over
nearby points remains as the fallback for scattered or ragged data.

### `estimateSailSpeed(target, points, config?) → InterpolationResult`

The entry point. With the default `strategy: 'auto'`:

```
1. buildPolarGrid     — group points into TWS columns (exact TWS), rows by TWA
2. Bilinear attempt   — bracket TWS between two columns (gap ≤ maxTwsGap),
                        linearly interpolate TWA within each (gap ≤ maxTwaGap),
                        blend the column speeds linearly in TWS
3. On failure → clustered grid — buildClusteredPolarGrid, retry bilinear
4. Still failing → IDW — the pre-grid scattered-point path (below)
→ { predictedSpeed, confidence, pointsUsed }
```

There is no global "is it a grid" heuristic — **the grid attempt is the
detection**. If the exact-TWS grid can't bracket or clamp the target
(single-point columns, a ragged column missing the TWA range, over-wide gaps,
too far outside the grid), a **noise-tolerant clustered grid** is built and the
bilinear attempt retried; only if that also fails does the query fall back to
IDW. `strategy: 'idw'` forces the fallback path everywhere (pre-upgrade
behaviour); `'bilinear'` forces the grid path (exact then clustered) and
returns a zero result when both fail.

### Grid invariant: one row per (TWS, TWA) node

**A `PolarGrid` never holds two rows at the same (TWS, TWA) node.** Both
builders guarantee it, collapsing colliding rows into one `PolarGridRow`
carrying the **median** speed and `n`, the count of stored points behind it
(duplicate count on the exact grid, bin population on the clustered one).

Nothing on the write side prevents duplicates — `sailPolar` has no unique
constraint, and CSV import bulk-inserts every parsed row — so importing the same
CSV twice used to be quietly catastrophic: duplicates injected zero-width gaps
into the TWA axis, `medianAxisGap` returned 0, and confidence collapsed to
exactly 0, which makes the suggestion pipeline ignore the polar table entirely
(`blend.lowConfidence`) while the predicted speeds still looked right. The
invariant sits upstream of that and of two subtler defects: brackets chosen by
SQLite's row order, and the four bilinear corners taken from different duplicate
sets. Being a read-side rule, duplicates already in a user's database self-heal
at the next query.

Collision means **exact** equality, never a tolerance — tolerance-based merging
is `buildClusteredPolarGrid`'s job below, and doing it at two widths in two
places produces results nobody can explain. Median is deliberately neutral: a
high statistic here would re-apply optimism already applied at promotion.

`n` is **carried but not spent** — duplicates must never lower confidence, and
they do not raise it either (that is
[`nmea-ingestion 16`](../../../.tickets/nmea-ingestion/issues/16-blend-weight-and-coverage.md)'s
question to price). `pointsUsed` therefore still counts *nodes*, not stored
rows. Decided in
[`nmea-ingestion 15`](../../../.tickets/nmea-ingestion/issues/15-duplicate-point-collision.md).

### Noise-tolerant clustered grid (`buildClusteredPolarGrid`)

Logged instrument data is a grid buried in noise: measurement scatter gives
nearly every point a unique TWS, so **exact-TWS grouping yields only single-row
columns and bilinear can never bracket** — the pre-G engine fell back to IDW on
every logged import. The clustered builder revives the grid path:

- **TWS clustering** — walk the sorted TWS values and start a new column
  whenever the gap exceeds `twsClusterTolerance` (1 kn); each cluster becomes
  one column at its points' mean TWS (a real centroid, not a lattice point).
- **TWA binning** — group each column's points into fixed-width `twaBinDeg` (4°)
  bins, each collapsed to one row at the bin's mean TWA carrying the bin's
  **median** speed (robust to per-run speed scatter). Gap-based clustering can't
  be used on TWA — per-node angular noise overlaps the node spacing — so a fixed
  bin is used here.

On clean hand-entered tables this reduces to the identity of `buildPolarGrid`
(each exact TWS is its own cluster; each single-point bin keeps its speed), so
trying it only after the exact grid fails never perturbs clean data. Introduced
in [Package G](../../docs/sail-suggestion/package-g-noise-tolerant-grid.md).

On a regular grid the bilinear path recovers stored speeds **exactly** at grid
nodes and the linear blend of the 4 bracketing corners between them — unlike
IDW, which plateaus at data points and can never predict above/below its
neighbours. Targets just outside the grid **clamp** to the nearest column/row
(degrading to 1-D interpolation) with confidence reduced in proportion to the
overshoot, bounded by `maxTwsDelta`/`maxTwaDelta`.

**Confidence (bilinear)** is a bracketing statement — per-axis factors,
multiplied:

```
axisFactor = 1.0                       when bracketed (gap ≤ maxGap)
           = max(0, 1 − dist/maxDelta) when clamped past the grid's edge
gapFactor  = min(1, typicalGap/actualGap)   per axis; typicalGap = median
                                            spacing of that axis's grid lines
confidence = twsFactor × twaFactor × twsGapFactor × twaGapFactor
```

A target bracketed inside a regularly spaced grid scores **1.0**.

### IDW fallback

```
1. Filter points to a search window (|ΔTWS| ≤ maxTwsDelta, |ΔTWA| ≤ maxTwaDelta)
2. selectNearestPoints — k nearest by weighted distance (returned with distances)
3. interpolateSpeed   — IDW blend:  Σ(speed·w) / Σw,  w = 1/distᵖ
4. computeConfidence  — 0–1 reliability score
```

**Distance metric** is a weighted Euclidean where TWA degrees are scaled to be
comparable to TWS knots:

```
distance = sqrt(ΔTWS² + (ΔTWA · twaScale)²)
```

**Confidence (IDW, 0–1)** blends three factors (weights in config):

| Factor       | Default weight | Meaning                                                    |
| ------------ | -------------- | ---------------------------------------------------------- |
| distance     | 0.5            | How close the nearest points are vs. the max search radius |
| point count  | 0.3            | How many points fall in the window (saturates at `k`)      |
| coverage     | 0.2            | Whether points bracket the target in both TWS and TWA      |

The suggestion engine buckets the raw confidence (either path) into
high/moderate/low display tiers — see
[sailSuggestion](../sailSuggestion/README.md#3-confidence-tier). Bilinear
confidences skew higher than IDW's on grid data by design: a target sitting
inside four real measurements deserves it.

### Tuning (`model/interpolation.ts`)

`DEFAULT_INTERPOLATION_CONFIG` and its `InterpolationConfig` type live in
[`model/interpolation.ts`](model/interpolation.ts). Defaults:

| Param            | Default | Meaning                                                    |
| ---------------- | ------- | ---------------------------------------------------------- |
| `strategy`       | `'auto'` | Bilinear when the data grids around the target, else IDW  |
| `maxTwsGap`      | 8       | Max TWS gap (kn) between bracketing columns bilinear trusts |
| `maxTwaGap`      | 20      | Max TWA gap (°) between bracketing rows bilinear trusts    |
| `twsClusterTolerance` | 1  | Max TWS gap (kn) within one clustered column (noisy-grid revival) |
| `twaBinDeg`      | 4       | TWA bin width (°) for de-noising rows within a clustered column |
| `k`              | 6       | Nearest points used (IDW)                                  |
| `p`              | 2       | IDW exponent (higher → closer points dominate)             |
| `twaScale`       | 0.25    | 4° TWA ≈ 1 kn TWS in the distance metric (IDW)             |
| `maxTwsDelta`    | 8       | Search window half-width in TWS (kn); also bounds bilinear clamping |
| `maxTwaDelta`    | 40      | Search window half-width in TWA (°); also bounds bilinear clamping |
| `confidenceWeights` | 0.5 / 0.3 / 0.2 | distance / pointCount / coverage (IDW, sum to 1) |

`estimateSailSpeed` accepts a `Partial<InterpolationConfig>` to override any of
these (the suggestion engine passes `suggestionConfig.interpolation` through).
With no data it returns `{ predictedSpeed: 0, confidence: 0, pointsUsed: [] }`.

## Charts, import, CRUD

- **Charts:** `PolarPlotChart` (radial) and `ScatterChart` render a sail's
  polars; the `polarChartType` setting picks which. Built on `victory-native` +
  Skia. Chart shaping lives in `util/chartData.ts`.
- **Import:** `SailPolarImportDialog` + `util/sharing.ts` import polars from CSV
  (the `polars/` tool in the workspace root generates random test CSVs).
- **CRUD:** `api/createSailPolar`, `getSailPolars`, `deleteSailPolar`, plus
  `NewSailPolarDialog`.

## Files

```
sailPolar/
├── index.ts
├── model/
│   ├── sailPolar.ts        SailPolar type + schema
│   └── interpolation.ts    PolarPoint, InterpolationConfig, DEFAULT_INTERPOLATION_CONFIG
├── util/
│   ├── interpolation.ts    estimateSailSpeed: bilinear path + IDW fallback  (+ __tests__/)
│   ├── polarGrid.ts        grid build + axis bracket search for the bilinear path
│   ├── chartData.ts        polar/scatter chart shaping
│   └── sharing.ts          CSV import/export
└── components/
    ├── PolarPlotChart.tsx  ScatterChart.tsx  SailPolars.tsx
    ├── SailPolarImportDialog.tsx  NewSailPolarDialog.tsx  SailPolarListItem.tsx
```

## Related

- Consumed by [sailSuggestion](../sailSuggestion/README.md) via
  `estimateSailSpeed`.
- TWA limits (the complementary signal when polars are sparse):
  [`features/sailTwaLimit`](../../docs/features.md).
