# Package E — Evaluation harness + fixture suite

> Round-2 package from [`accuracy-review.md`](./accuracy-review.md): the
> measurement layer packages F/G/H are judged by. Ships an **opt-in accuracy
> sweep** (a jest suite excluded from the default run), a **seeded fixture
> generator** with four named variants, and a **locked baseline** the sweep
> ratchets against. No engine code changes — the suggestion pipeline is
> exercised strictly through its public `suggestSails` API.

## What it is

The round-2 review measured the engine with a throwaway sweep; this package
makes that measurement repeatable, deterministic, and enforced. Three parts:

1. **Fixture generator** — `polars/generate-polars.js` (rewritten). Emits
   named dataset variants into `polars/fixtures/`, each as a CSV in the app's
   polar-import format plus a `*.manifest.json` carrying the **ground truth**
   the CSV was generated from (each sail's true TWA band, base speed curve,
   symmetry, optional explicit limits) and the sweep spec. All randomness
   comes from a seeded PRNG (mulberry32), so regeneration is byte-for-byte
   reproducible and baselines stay stable.
2. **Harness** — `features/sailSuggestion/eval/` in the app. Pure fixture /
   ground-truth / sweep logic plus an opt-in jest suite that runs the real
   `suggestSails` pipeline (default config) over each fixture's condition
   space and scores it against the manifest.
3. **Baseline lock** — per-fixture accuracy counts hardcoded in the eval suite
   as a **ratchet**: scores may improve or hold, never regress. Locked numbers
   are recorded in [`accuracy-review.md`](./accuracy-review.md)'s status
   table.

## How to run it

```bash
# From sailplan-app/ — the opt-in accuracy sweep (~2 s):
npm run eval:suggestions

# Regenerate fixtures (only needed if the recipes change; output is committed):
node ../polars/generate-polars.js            # all variants
node ../polars/generate-polars.js noisy-log  # one variant
```

The sweep prints one report per fixture — summary metrics, a per-condition
failure map (rows = TWA, cols = TWS; `.` ok, `L` wrong leader, `M` expected
sail absent from the suggested list, `B` both, `·` skipped), and the first 40
failures in detail — then asserts the ratchet.

The default `npx jest` run does **not** include the sweep: `accuracy.eval.ts`
matches no default `testMatch` pattern, and `npm run eval:suggestions` uses
`jest.eval.config.js` (`testMatch: ['**/*.eval.ts']`) to select it. The
harness's own ground-truth logic *is* unit-tested in the default run
(`eval/__tests__/fixture.test.ts`) — the D3 rule below is easy to get subtly
wrong, and every harness number depends on it.

## Files

| File                                                | What it does                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `polars/generate-polars.js`                         | Seeded generator; emits `polars/fixtures/<variant>.csv` + `.manifest.json`       |
| `polars/fixtures/`                                  | Committed fixture CSVs + ground-truth manifests                                  |
| `features/sailSuggestion/eval/fixture.ts`           | Manifest types, CSV parsing, fixture assembly, ground-truth + D3 rule (pure)     |
| `features/sailSuggestion/eval/sweep.ts`             | `runAccuracySweep` (metrics) + `formatSweepReport` (pure)                        |
| `features/sailSuggestion/eval/accuracy.eval.ts`     | The opt-in suite: loads fixtures (fs), prints reports, asserts the ratchet       |
| `features/sailSuggestion/eval/__tests__/fixture.test.ts` | Default-run unit tests for the ground-truth logic                           |
| `jest.eval.config.js`                               | Jest config selecting `**/*.eval.ts` (used by `npm run eval:suggestions`)        |

The `eval/` directory is harness-only: it is not exported from the feature
barrel and must never be imported by app code (`accuracy.eval.ts` uses `fs`).
File IO lives only in the eval suite; `fixture.ts` / `sweep.ts` stay pure so
they're unit-testable without touching disk.

## Fixture variants

All share the six-sail downwind fleet from the round-2 review (A6, A5, A3,
A2, S1.5, S1 — bands and base speed curves in the manifests). Samples exist
only inside each sail's band; the expected winner at any condition is the
fastest sail whose band contains the TWA, by true base speed at that TWS.

| Variant      | Seed | Data shape                                            | What it exercises                                     |
| ------------ | ---- | ------------------------------------------------------ | ------------------------------------------------------ |
| `noisy-log`  | 42   | 3 samples/node, ±0.3 kn TWS, −2..+2° TWA, 0.82–1.15× speed noise | Logged-instrument scatter — the review's recipe, seeded |
| `clean-grid` | 42   | 1 noise-free sample/node                               | Hand-entered polar tables — the bilinear path           |
| `with-limits`| 42   | **Byte-identical CSV to `noisy-log`**                  | Explicit TWA limits (manifest) for A6/A2/S1 — limit scoring + `skipWhenLimitsDefined` |
| `upwind`     | 7    | Noisy fleet + J1 jib (35–60°)                          | The upwind wind zone; the 60–95° coverage gap is skipped |

`noisy-log` and `with-limits` share a seed and recipe deliberately: any score
difference between them is attributable to the explicit limits alone. The
legacy unseeded `polars/polars_random.csv` (the file the review measured) is
kept for hand-feeding the app's import but is no longer regenerated.

## Scoring: metrics and the D3 rule

Per fixture, the sweep runs `suggestSails` at every manifest sweep node
(default: TWA 95–180° in 5° steps × TWS {6, 10, 14, 18, 22} kn = 90
conditions; `upwind` starts at 35°). Conditions where no sail's band contains
the TWA (coverage gaps) are skipped, not scored.

- **Wrong leader** — the top-ranked sail is not an acceptable leader.
  Reported both **strict** (must be the band winner) and **D3-adjusted**.
- **Expected absent** — no acceptable leader appears anywhere in the
  suggested list (D3-adjusted).
- **Bilinear served** — per sail × condition, `estimateSailSpeed` is re-run
  with `strategy: 'bilinear'`; since the default `'auto'` tries bilinear
  first, "forced-bilinear succeeds" is exactly "the real evaluation was
  served by the bilinear path". This is Package G's headline number.

**D3 boundary tolerance** (product decision D3 in the accuracy review): at a
crossover angle — within one 5° grid step of a band edge — either
neighbouring sail counts as a correct leader. Implemented in
`acceptableLeaders`: for every band edge within tolerance of the target TWA,
the strict winners just *either side* of that edge are acceptable. Sampling
exactly *at* an edge would resolve the tie to the faster sail and silently
drop the neighbour whose band ends there, making the rule asymmetric — the
unit tests pin this case.

## The ratchet

`accuracy.eval.ts` holds `BASELINES` — absolute per-fixture counts (the
fixtures and engine are deterministic, so counts are exact). Wrong-leader and
expected-absent are ceilings; bilinear-served is a floor. A regression fails
the suite; an improvement passes.

**When a package (F/G/H) improves the numbers:** run the sweep, copy the new
counts into `BASELINES` (tightening the ratchet), and record them in the
status table of [`accuracy-review.md`](./accuracy-review.md). That table —
not this doc — is the running scoreboard.

## Locked baseline (packages 0/A–D engine, 2026-07-06)

| Fixture      | Wrong leader (D3-adj) | strict        | Expected absent | Bilinear served  |
| ------------ | ---------------------- | ------------- | ---------------- | ----------------- |
| `noisy-log`  | 47/90 (52.2 %)         | 64/90 (71.1 %) | 11/90 (12.2 %)   | 0/540 (0 %)       |
| `clean-grid` | 28/90 (31.1 %)         | 47/90 (52.2 %) | 1/90 (1.1 %)     | 460/540 (85.2 %)  |
| `with-limits`| 49/90 (54.4 %)         | 64/90 (71.1 %) | 13/90 (14.4 %)   | 0/540 (0 %)       |
| `upwind`     | 53/120 (44.2 %)        | 69/120 (57.5 %) | 15/120 (12.5 %) | 20/840 (2.4 %)    |

Reading the baseline against the review's findings:

- **Strict wrong-leader on `noisy-log` is 71.1 %** — reproducing the review's
  73 % on the unseeded legacy CSV and confirming the seeded recipe matches.
  The D3 adjustment absorbs boundary flips down to 52.2 %; the rest is the
  R2.2 extrapolation-dominance failure (e.g. A3 leading from 95° to 165°).
- **Bilinear serves 0 % on noisy data** — finding R2.1 verbatim. On
  `clean-grid` it serves 85.2 %, not ~100 %: sweep conditions past the data
  grid's edges (e.g. TWA 175–180° at low TWS where only S1's narrow band is
  near) fail the grid attempt and fall back to IDW. Package G's gate
  (">0 % noisy, ~100 % clean") should judge itself against 85.2 %, not 100.
- **`with-limits` is currently *slightly worse* than `noisy-log`** (49 vs 47)
  — explicit limits don't rescue the ranking while IDW extrapolation
  dominates the blend at high confidence. Expect this ordering to flip when
  F/H land.
- **`clean-grid` is far better than `noisy-log`** (31.1 % vs 52.2 %) even
  though both suffer R2.2 — bilinear's bracketing confidence punishes
  out-of-band targets harder than IDW's does.

## Design notes

- **Why an opt-in jest suite, not a standalone script:** the harness must
  import the real pipeline (TypeScript, `~/` path aliases); the `jest-expo`
  transform already handles both, so a second config file
  (`jest.eval.config.js`) is the entire cost. A standalone runner would need
  its own ts-node/alias setup for zero benefit.
- **Why counts, not percentages, in `BASELINES`:** exact integer equality
  makes the ratchet bite on a single-condition regression and avoids
  float-formatting drift.
- **Why ground truth lives in manifests, not the harness:** fixtures and
  their truths travel together; adding a variant (or changing a band) never
  touches harness code. The harness re-derives expected winners from the
  manifest's bands + base speed curves with the same interpolation the
  generator uses.
- **Sail ids** are assigned 1..n in manifest order; CSV rows are matched by
  name case-insensitively, mirroring the app's import.

## Gate (from the accuracy review)

> Harness runs green on all fixtures and reports per-fixture scores.

Met: `npm run eval:suggestions` — 8 tests green across the four fixtures,
per-fixture reports printed, ratchet locked at the table above. The default
`npx jest` run stays green and does not execute the sweep.
