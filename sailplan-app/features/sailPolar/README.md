# Sail Polar Feature

Stores and reasons about **sail polars** — the performance data that says how
fast a boat goes at a given wind speed (TWS) and wind angle (TWA) with a given
sail. This feature owns polar CRUD, CSV import, the polar/scatter charts, and the
**interpolation engine** that the [sail suggestion pipeline](../sailSuggestion/README.md)
relies on.

See the [domain glossary](../../docs/domain-glossary.md#polars) for what a polar
is. The interpolation source ([`util/interpolation.ts`](util/interpolation.ts))
carries thorough JSDoc — this README is the map.

## Data model

A polar is many discrete `PolarPoint`s (`{ tws, twa, speed }`), stored in the
`sailPolar` table, one set per sail. `PolarPoint` is
`Pick<SailPolar, 'tws' | 'twa' | 'speed'>`.

## Interpolation (`util/interpolation.ts`)

Real conditions rarely land on a stored point, so boat speed is **estimated** by
**Inverse Distance Weighting (IDW)** over nearby points.

### `estimateSailSpeed(target, points, config?) → InterpolationResult`

The entry point. Pipeline:

```
1. Filter points to a search window (|ΔTWS| ≤ maxTwsDelta, |ΔTWA| ≤ maxTwaDelta)
2. selectNearestPoints — k nearest by weighted distance
3. interpolateSpeed   — IDW blend:  Σ(speed·w) / Σw,  w = 1/distᵖ
4. computeConfidence  — 0–1 reliability score
→ { predictedSpeed, confidence, pointsUsed }
```

**Distance metric** is a weighted Euclidean where TWA degrees are scaled to be
comparable to TWS knots:

```
distance = sqrt(ΔTWS² + (ΔTWA · twaScale)²)
```

**Confidence (0–1)** blends three factors (weights in config):

| Factor       | Default weight | Meaning                                                    |
| ------------ | -------------- | ---------------------------------------------------------- |
| distance     | 0.5            | How close the nearest points are vs. the max search radius |
| point count  | 0.3            | How many points fall in the window (saturates at `k`)      |
| coverage     | 0.2            | Whether points bracket the target in both TWS and TWA      |

The suggestion engine buckets this raw score into high/moderate/low tiers with
zone-specific thresholds — see
[sailSuggestion](../sailSuggestion/README.md#3-confidence-tier).

### Tuning (`model/interpolation.ts`)

`DEFAULT_INTERPOLATION_CONFIG` and its `InterpolationConfig` type live in
[`model/interpolation.ts`](model/interpolation.ts). Defaults:

| Param            | Default | Meaning                                                    |
| ---------------- | ------- | ---------------------------------------------------------- |
| `k`              | 6       | Nearest points used                                        |
| `p`              | 2       | IDW exponent (higher → closer points dominate)             |
| `twaScale`       | 0.25    | 4° TWA ≈ 1 kn TWS in the distance metric                   |
| `maxTwsDelta`    | 8       | Search window half-width in TWS (kn)                       |
| `maxTwaDelta`    | 40      | Search window half-width in TWA (°)                        |
| `confidenceWeights` | 0.5 / 0.3 / 0.2 | distance / pointCount / coverage (sum to 1)       |

`estimateSailSpeed` accepts a `Partial<InterpolationConfig>` to override any of
these. With no points in range it returns `{ predictedSpeed: 0, confidence: 0,
pointsUsed: [] }`.

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
│   ├── interpolation.ts    estimateSailSpeed + IDW internals  (+ __tests__/)
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
