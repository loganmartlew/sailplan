# Package G — Noise-tolerant grid (revive bilinear)

> Round-2 package from [`accuracy-review.md`](./accuracy-review.md): the fix for
> finding **R2.1** ("the bilinear path never runs on noisy data"). When
> exact-TWS grouping can't form a usable grid — the signature of logged
> instrument data — a **clustered grid** is built and the bilinear attempt
> retried, so the Package D interpolation path finally fires on the kind of data
> the app actually imports. Judged by Package E's harness — `noisy-log`
> bilinear-served **0 % → 84.3 %**, with leader accuracy improving or holding on
> every fixture.

## The problem it fixes

Polar data is naturally a grid (TWS columns × TWA rows), and `buildPolarGrid`
groups points into columns by **exact** TWS value. That works for hand-entered
tables, whose rows repeat TWS exactly. It fails completely on logged data:
±0.3 kn of TWS measurement noise gives nearly every point a unique TWS, so every
"column" holds a single row, `sampleColumn` rejects it (< 2 rows), and the grid
attempt fails at every condition → **100 % IDW fallback** (R2.1). Package D's
bilinear path — more accurate and cheaper than IDW, and the whole point of that
round — was dead weight against any logged/noisy dataset, serving **0/540**
evaluations on `noisy-log` while serving 85.2 % on `clean-grid`.

The two input shapes are both legitimate (product decision **D1**): hand-entered
tables (clean grids) *and* imported logs (noisy scatter around a grid). G makes
the engine tolerate the noise in the grid builder rather than aggregate at
import time — raw rows stay in the DB untouched, so charts and CSV round-trips
are unaffected and no migration is needed.

## What it does

One new pure helper plus a one-line change to the interpolation entry point — no
changes to the bilinear math, the confidence model, `rankSails`, or the blend.

1. **Cluster into a noise-tolerant grid** — `util/polarGrid.ts`
   (`buildClusteredPolarGrid`). Two axes, two methods, because the noise
   structure differs per axis:
   - **TWS — adaptive gap clustering.** Walk the sorted TWS values; start a new
     column whenever the gap to the previous value exceeds `twsClusterTolerance`
     (1 kn). Each cluster becomes one column at its points' **mean** TWS. The
     tolerance sits below the real column spacing yet above the per-node TWS
     scatter, so the true grid re-forms without chaining adjacent columns
     together.
   - **TWA — fixed-width binning.** Within each column, group points into
     fixed-width `twaBinDeg` (4°) bins (`round(twa / twaBinDeg)`), each collapsed
     to one row at the bin's **mean** TWA carrying the bin's **median** speed.
     Gap clustering can't be used here: per-node angular noise (±2° on ~5°
     spacing) overlaps the node spacing, so no single gap threshold separates
     within-node scatter from between-node steps. A fixed bin, plus a median
     speed, de-noises each node robustly.

2. **Retry bilinear on the clustered grid** — `util/interpolation.ts`. The
   `'auto'`/`'bilinear'` flow now tries the **exact** grid first (unchanged),
   and only when that returns `null` builds the clustered grid and retries the
   bilinear attempt; IDW remains the last resort. The clustered grid is built
   lazily — only for queries the exact grid couldn't serve.

Config lives in `model/interpolation.ts` under two new
`DEFAULT_INTERPOLATION_CONFIG` knobs (`twsClusterTolerance: 1`, `twaBinDeg: 4`),
threaded through exactly like every other interpolation parameter.

## Why fallback, not replacement (clean-grid held byte-for-byte)

The clustered builder is tried **only when the exact grid fails**, not in place
of it. This is deliberate and it's why `clean-grid` holds its 85.2 %
bilinear-served and 0 % wrong-leader exactly:

- On noise-free data the clustered builder **reduces to the identity** of
  `buildPolarGrid` — each exact TWS is its own cluster (gaps exceed the
  tolerance), and each single-point TWA bin keeps its own speed. So the clustered
  grid is identical to the exact grid.
- Because the exact attempt runs first and serves clean data wherever it can,
  the clustered path is never even reached on `clean-grid`. G's effect is
  therefore isolated to exactly the queries the old engine dropped to IDW —
  maximally bisectable, per the round-2 "one score-space move per package" rule.

## Tuning (calibrated against the harness)

`twsClusterTolerance` and `twaBinDeg` were swept over the E fixtures. The 1 kn /
4° pair holds `noisy-log` at its F baseline (wrong-leader 2/90) while maximising
bilinear coverage and improving `with-limits`/`upwind`:

- **TWS tolerance must stay ≤ ~1.25 kn.** At 1.5 kn, noisy 2-kn-spaced columns
  begin merging (their ±0.3 kn scatter closes the ~1.4 kn min gap), chaining
  columns together and collapsing bilinear coverage from ~455 to ~140.
- **TWA bin is a shallow optimum.** Bins of 3°, 4°, and 6° all hold `noisy-log`
  at 2 wrong leaders; 5° happened to land one crossover the wrong way. 4° gives
  the best `upwind` accuracy of the group, so it's the default — representative,
  not a knife-edge.

## Results (Package E harness, default config)

| Fixture      | Bilinear served (F → G) | Wrong leader (F → G) | Notes                         |
| ------------ | ----------------------- | -------------------- | ----------------------------- |
| `noisy-log`  | 0 % → **84.3 %**        | 2.2 % → 2.2 %        | R2.1 fixed; accuracy held     |
| `clean-grid` | 85.2 % → 85.2 %         | 0 % → 0 %            | held byte-for-byte            |
| `with-limits`| 0 % → **84.3 %**        | 25.6 % → **15.6 %**  | de-noised speeds help ranking |
| `upwind`     | 2.4 % → **58.6 %**      | 3.3 % → **1.7 %**    | jib zone included             |

`with-limits` still trails on leader accuracy for the same reason as under F —
explicitly-limited sails (A2, A6) extrapolating past their user limits and
winning at high confidence. G reshapes the speed estimate but not the explicit
limit path; enforcing explicit limits remains **Package H**'s target.

## Gates (all green)

- Bilinear serves > 0 % on `noisy-log` — **met** (84.3 %).
- ~100 % on `clean-grid` — **met** against the achievable 85.2 % ceiling (sweep
  conditions past the grid's edges fall to IDW on both paths, so 85.2 %, not
  100 %, is the bound; see [Package E](./package-e-eval-harness.md)).
- Harness scores improve or hold on all fixtures — **met** (two improve, two
  hold; none regress).
- Round-1 scenario table stays green — **met** (166 default tests pass; clean
  grids are unaffected by the fallback).
- Ratchet re-locked to G's numbers in `accuracy.eval.ts` so H cannot regress the
  bilinear-served floors or the leader-accuracy gains.

## Files

- `features/sailPolar/util/polarGrid.ts` — `buildClusteredPolarGrid` + TWA
  binning helper (new).
- `features/sailPolar/util/interpolation.ts` — clustered-grid retry between the
  exact grid attempt and the IDW fallback.
- `features/sailPolar/model/interpolation.ts` — `twsClusterTolerance`,
  `twaBinDeg` config knobs.
- Tests: `util/__tests__/bilinear.test.ts` — `buildClusteredPolarGrid` unit
  cases + a noisy-grid integration test (exact grid fails, clustered revives
  bilinear).
- `eval/accuracy.eval.ts` — baselines re-locked to G's numbers.

## Not in scope (deferred to H)

- Enforcing **explicit** TWA limits against extrapolation (the `with-limits`
  residual) — extends F's implicit-envelope trust-suppression to the explicit
  path.
- Confidence/window recalibration (R2.3): coverage weight, `maxTwaDelta`
  tightening, `blend.lowConfidence`/`highConfidence` against the reshaped
  distribution.
- Import-time aggregation (the D1 fallback design): only needed if in-engine
  binning ever proves distorting on a real dataset; the harness shows it does
  not on these fixtures.
