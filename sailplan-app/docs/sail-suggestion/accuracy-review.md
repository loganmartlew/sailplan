# Sail Suggestion Engine — Accuracy Review (Round 2)

> Findings from a quantitative evaluation of the suggestion engine (July 2026,
> after all round-1 packages 0/A–D landed) against the generated test polar
> dataset, plus the work packages that come out of it. The
> [round-1 review](./improvements.md) fixed the scoring *structure*; this
> review measures the engine's *accuracy* end-to-end and traces the remaining
> failures. The companion
> [feature README](../../features/sailSuggestion/README.md) documents current
> behaviour.

## Method

The test dataset (`polars/polars_random.csv`, 1,079 rows) is produced by
`polars/generate-polars.js`, which **encodes its own ground truth**: each sail
has an intended TWA band and base speed curve, and samples exist only inside
the band (with ±0.3 kn TWS noise, ±2° TWA noise, 3 samples per node, and a
0.82–1.15× speed factor simulating trim/surfing).

| Sail | Band (TWA) | Symmetric | Base speed @16 kn |
| ---- | ---------- | --------- | ----------------- |
| A6   | 95–120°    | no        | 10.5              |
| A5   | 110–130°   | no        | 11.7              |
| A3   | 125–140°   | no        | 13.4              |
| A2   | 140–165°   | no        | 11.9              |
| S1.5 | 150–170°   | yes       | 11.0              |
| S1   | 165–180°   | yes       | 9.4               |

The evaluation sweeps the condition space (TWA 95–180° in 5° steps × TWS
{6, 10, 14, 18, 22} kn = 90 conditions), runs the real `suggestSails` pipeline
on the fleet with **no TWA limits** (matching the CSV import, which carries
polars only), and scores against the expected winner — the fastest sail whose
band contains the TWA.

## Baseline results

| Metric                                           | Result          |
| ------------------------------------------------ | --------------- |
| Wrong top pick                                   | 66 / 90 (73 %)  |
| Expected sail absent from suggested list (worst) | 15 / 90 (17 %)  |
| Evaluations served by the bilinear path          | 0 / 540 (0 %)   |

Illustrative failures:

- **A3 (band 125–140°) leads from TWA 95° to 165°** across mid/high wind —
  e.g. at 18 kn it wins at 100–120° where only A6/A5 should compete.
- **At 22 kn / 170–180°, A2 (asym, band ends 165°) outranks both symmetric
  kites**; at 175° the correct S1 isn't suggested at all.
- Every evaluation used 6 IDW points — the Package D bilinear path never
  engaged once.

## Findings

### R2.1 — The bilinear path never runs on noisy data

**Where:** `~/features/sailPolar/util/polarGrid.ts` (`buildPolarGrid`).

Grid columns are grouped by **exact** TWS value. The generator's ±0.3 kn TWS
noise gives nearly every point a unique TWS, so every "column" has one row,
`sampleColumn` rejects it (< 2 rows), and the grid attempt always fails →
100 % IDW fallback. Package D is dead weight against any logged/noisy dataset;
it only ever fires on hand-entered tables with exactly repeated TWS values.

### R2.2 — IDW extrapolation lets fast sails win at angles they can't sail

**Where:** `~/features/sailPolar/util/interpolation.ts` (IDW window) +
`DEFAULT_INTERPOLATION_CONFIG.maxTwaDelta = 40°`.

A sail's edge-of-band points project up to 40° beyond its band at roughly the
edge speed. Whichever sail has the fastest measurements *anywhere within ±40°*
wins, regardless of whether it can be flown at the target angle. This is the
dominant failure mode (most of the 73 %).

The root modelling gap: **absence of data at an angle is evidence the sail is
not flown there**, but the engine treats it as merely "less confident —
extrapolate anyway."

### R2.3 — Confidence doesn't punish extrapolation enough for the blend to matter

**Where:** IDW `computeConfidence` weights + `blend.highConfidence`.

A one-sided extrapolation 20–35° outside a sail's band still scores confidence
0.60–0.85: the coverage term (the only one that knows about bracketing) is
weighted 0.2, and a dense band maxes the point-count term regardless of where
the target is. With `highConfidence = 0.70`, these extrapolations get full or
near-full polar weight. And with no limits in the dataset, the `(1−w)·limitScore`
term is null — low confidence has nothing to fall back on, so polar score
dominates at every confidence level.

### R2.4 — The test dataset exercises half the engine

The CSV import carries polars only, so in all on-device testing to date the
trapezoid limit curve, the limit fallback philosophy, and
`skipWhenLimitsDefined` have been **inert**. The data is also downwind-only and
noisy-scatter-only. Its randomness is *not* the main realism problem — ±15 %
trim noise is plausible for logged data. The shape mismatch is: timestamped
noisy scatter mimics **logged instrument data**, while the grid path expects
**hand-entered polar tables**. Both are legitimate inputs for this app.

## Product decisions

These gate the packages below. Defaults recorded here; revisit at package
kick-off.

- **D1 — What shape is polar input?** Working answer: **both** hand-entered
  tables (clean grids) and imported logs (noisy scatter). Consequence: the
  engine must either aggregate logs into a grid at ingestion or tolerate noise
  in the grid builder (Package G does the latter, with import-time binning as
  the fallback design).
- **D2 — Does polar coverage act as an implicit TWA limit when no explicit
  limits exist?** Working answer: **yes** — a sail's observed data band is
  treated as evidence of its usable envelope, feeding the existing trapezoid
  limit machinery (Package F). Explicit user-entered limits always win.
- **D3 — What counts as "correct" at band boundaries?** Working answer: at a
  crossover angle (within one 5° grid step of a band edge), either neighbour
  counts as a correct leader; elsewhere the band winner must lead, and must
  always appear in the suggested list.

## Work packages

Round-1 lesson retained: ship score-space changes in measurable, bisectable
units. The harness (E) makes each subsequent package's effect a number, so
F/G/H stay separate even though they interact.

### Package E — Evaluation harness + fixture suite

The measurement layer everything else is judged by.

1. **Harness**: an opt-in script/test (not part of the default `jest` run)
   that loads a fixture dataset, sweeps the condition space, applies the D3
   boundary-tolerance rule, and reports **leader accuracy** and
   **suggested-list accuracy**, with a per-condition failure map. Seeded from
   the throwaway sweep used for this review.
2. **Baseline lock**: record the current numbers (73 % / 17 % on
   `polars_random.csv`) in this doc's status table.
3. **Fixture suite**: extend the generator to emit named variants, each with
   its own ground-truth manifest —
   - `noisy-log` (the current output),
   - `clean-grid` (no noise, one sample per node — exercises bilinear),
   - `with-limits` (explicit TWA limits for a subset of sails — wakes the
     limit path and `skipWhenLimitsDefined`),
   - at least one upwind sail (jib) so zone handling is exercised.

**Gate:** harness runs green on all fixtures and reports per-fixture scores.

### Package F — Coverage-aware ranking (implicit TWA envelopes)

The fix for R2.2 — expected to be the single biggest accuracy win.

- In `evaluateSail`, when a sail has polar data but **no explicit limits**,
  derive an implicit TWA envelope from its own data coverage (per TWS region),
  and score it through the **existing trapezoid limit machinery** — the
  architecture already has the right socket; this feeds it.
- Targets outside the observed envelope get the out-of-range decay instead of
  a trusted extrapolated speed; explicit limits, where present, take
  precedence unchanged.
- Config additions live in `suggestionConfig.ts` (envelope margin, minimum
  points to assert an envelope).

**Gate:** harness leader accuracy on `noisy-log` improves materially (target:
wrong-leader < 25 % from this package alone); `with-limits` fixture shows
explicit limits still winning over implicit ones; round-1 scenario table stays
green.

### Package G — Noise-tolerant grid (revive bilinear)

The fix for R2.1.

- Preferred: make `buildPolarGrid` cluster TWS values within a tolerance and
  bin TWA rows (median speed per bin), so noisy logs form usable columns.
- Fallback design if in-engine binning proves distorting: aggregate at
  **import time** (snap samples to grid nodes, median per node), keeping raw
  rows for charts.
- Deliberately after F and never bundled with it (same rule as round-1 A vs D:
  both move the confidence distribution; the harness must attribute movement).

**Gate:** bilinear serves > 0 % of evaluations on `noisy-log` and ~100 % on
`clean-grid`; harness scores improve or hold on all fixtures.

### Package H — Confidence & window recalibration

The fix for R2.3, done last because F and G both reshape the confidence
distribution it tunes against.

- Raise the coverage weight in IDW confidence so one-sided TWA bracketing
  hurts materially; re-balance distance/count weights.
- Tighten `maxTwaDelta` (40° → ~15–20°) and re-check `twaScale`.
- Re-verify `blend.lowConfidence` / `highConfidence` against the new
  distribution; re-tune `selection.margin` only if the harness says selection
  (not ranking) is now the weak spot.

**Gate:** harness scores across all fixtures; stop tuning when D3-adjusted
leader accuracy plateaus (target: > 90 % on `noisy-log` and `clean-grid`).

### Recommended order & effort

**E → F → G → H**, strictly sequential (each is judged by E, and F/G/H each
move the score space).

| Package | Effort (rough)  | Depends on |
| ------- | --------------- | ---------- |
| E       | small (~½ day)  | —          |
| F       | medium (1–2 d)  | E, D2      |
| G       | medium (1–2 d)  | E, F, D1   |
| H       | small (~½ day)  | E, F, G    |

## Status

| Package | Status | Baseline → after                                        |
| ------- | ------ | ------------------------------------------------------- |
| E       | Done   | locked (see below)                                      |
| F       | Done   | `noisy-log` wrong-leader 52.2 % → **2.2 %** (see below)  |
| G       | Done   | `noisy-log` bilinear-served 0 % → **84.3 %** (see below) |
| H       | —      |                                                         |

Update this table as packages land (link the PR/commit and the harness
numbers before/after).

Package E baseline, locked 2026-07-06 on the packages 0/A–D engine
(`npm run eval:suggestions`; methodology + commentary in
[`package-e-eval-harness.md`](./package-e-eval-harness.md)). Wrong-leader and
expected-absent are **D3-adjusted**; the review's raw 73 % corresponds to the
strict column (71.1 % on the seeded fixture):

| Fixture      | Wrong leader | strict          | Expected absent | Bilinear served  |
| ------------ | ------------- | --------------- | ---------------- | ----------------- |
| `noisy-log`  | 47/90 (52.2 %) | 64/90 (71.1 %)  | 11/90 (12.2 %)   | 0/540 (0 %)       |
| `clean-grid` | 28/90 (31.1 %) | 47/90 (52.2 %)  | 1/90 (1.1 %)     | 460/540 (85.2 %)  |
| `with-limits`| 49/90 (54.4 %) | 64/90 (71.1 %)  | 13/90 (14.4 %)   | 0/540 (0 %)       |
| `upwind`     | 53/120 (44.2 %) | 69/120 (57.5 %) | 15/120 (12.5 %) | 20/840 (2.4 %)    |

### After Package F (coverage-aware ranking)

Locked 2026-07-06 (`npm run eval:suggestions`, default config). The implicit
TWA envelope removes the extrapolation wins on every fixture whose mis-ranked
sails have no explicit limits:

| Fixture      | Wrong leader     | strict           | Expected absent | Bilinear served  |
| ------------ | ---------------- | ---------------- | --------------- | ---------------- |
| `noisy-log`  | **2/90 (2.2 %)** | 12/90 (13.3 %)   | 0/90 (0 %)      | 0/540 (0 %)      |
| `clean-grid` | **0/90 (0 %)**   | 0/90 (0 %)       | 0/90 (0 %)      | 460/540 (85.2 %) |
| `with-limits`| 23/90 (25.6 %)   | 34/90 (37.8 %)   | 9/90 (10 %)     | 0/540 (0 %)      |
| `upwind`     | **4/120 (3.3 %)**| 13/120 (10.8 %)  | 0/120 (0 %)     | 20/840 (2.4 %)   |

`noisy-log` clears F's gate (< 25 %) with room to spare. `with-limits` lags
because its residual failures are the **explicitly-limited** sails (A2, A6)
still extrapolating past their user limits and winning at high confidence: F's
trust-suppression only fires for implicit envelopes (explicit limits stay
unchanged by design), and the round-1 blend still weights a negative
`limitScore` by `(1−w)≈0` at high confidence. Extending the same suppression to
explicit limits is the highest-value follow-up — a natural Package H sub-item.
The `bilinear served` floors are untouched (that is Package G's job).

### After Package G (noise-tolerant grid)

Locked 2026-07-06 (`npm run eval:suggestions`, default config;
`twsClusterTolerance: 1`, `twaBinDeg: 4`). When exact-TWS grouping fails — the
signature of logged data — a clustered grid revives the bilinear path (R2.1),
so `bilinear served` jumps from 0 to ~84 % on the noisy fixtures. Its de-noised
speeds also lift leader accuracy on `with-limits` and `upwind` while holding
`noisy-log` and `clean-grid`:

| Fixture      | Wrong leader     | strict           | Expected absent | Bilinear served  |
| ------------ | ---------------- | ---------------- | --------------- | ---------------- |
| `noisy-log`  | 2/90 (2.2 %)     | 12/90 (13.3 %)   | 0/90 (0 %)      | **455/540 (84.3 %)** |
| `clean-grid` | 0/90 (0 %)       | 0/90 (0 %)       | 0/90 (0 %)      | 460/540 (85.2 %) |
| `with-limits`| **14/90 (15.6 %)** | 30/90 (33.3 %) | **6/90 (6.7 %)** | **455/540 (84.3 %)** |
| `upwind`     | **2/120 (1.7 %)**| 11/120 (9.2 %)   | 0/120 (0 %)     | **492/840 (58.6 %)** |

G clears its gate — bilinear serves > 0 % on `noisy-log` (84.3 %) and holds
`clean-grid`'s 85.2 % ceiling (the sweep conditions past the grid's edges still
fall to IDW on both paths, so 85.2 %, not 100 %, is the achievable bound). Every
score improves or holds. `clean-grid` is held **byte-for-byte**: on noise-free
data the clustered builder reduces to the exact grid, so the exact attempt still
serves it and the clustered path is never reached. `with-limits` still trails on
leader accuracy for the same reason as under F — explicitly-limited sails
extrapolating past their limits — which remains Package H's target.
