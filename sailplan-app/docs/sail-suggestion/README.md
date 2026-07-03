# Sail Suggestion Engine — Improvement Docs

Central home for the July 2026 suggestion-engine review and the implementation
plans that came out of it.

- [`improvements.md`](./improvements.md) — the review findings: what's wrong,
  why, and the agreed direction. Findings are organised into **tiers** by
  severity (1 = wrong suggestions, 2 = algorithmic, 3 = perf/integration,
  4 = code health).
- The **implementation plans** below are organised into **work packages** —
  the units the work actually ships in. This split is deliberate: the tier-1
  scoring flaws and several tier-2/4 items share one score space and must ship
  together (Package A), while other items must ship *apart* from it so diffs
  stay reviewable and regressions bisectable.

The engine's current behaviour is documented in the
[feature README](../../features/sailSuggestion/README.md).

## Implementation plans

| Plan                                                          | Ships                                             | Depends on |
| ------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| [Package 0 — Cleanup](./package-0-cleanup.md)                 | Debug-log removal, barrel-import fix              | —          |
| [Package A — Scoring core](./package-a-scoring-core.md)      | Continuous blend, trapezoid limits, guard recalibration, selection margin, config consolidation | Package 0 (trivial) |
| [Package B — Data-fetch hoist](./package-b-data-fetch-hoist.md) | One set of live queries per course instead of per leg | — (parallel with A) |
| [Package C — Reasoning UI](./package-c-reasoning-ui.md)      | Suggestion-breakdown sheet                        | A (fields) + B (data shape) |
| [Package D — Interpolation upgrade](./package-d-interpolation.md) | Bilinear grid interpolation with IDW fallback     | A (scenario harness) |

**Recommended order: 0 → A → B → C → D.** B is independent and can slot
anywhere; it must **not** be bundled with A. D is deliberately last — it
changes the confidence distribution, and A's scenario test table must already
exist to act as the regression harness.

## Finding → plan map

Every finding in [`improvements.md`](./improvements.md) is covered by exactly
one plan:

| Finding                                                    | Tier | Plan            |
| ---------------------------------------------------------- | ---- | --------------- |
| 1.1 Ranking scores not comparable across confidence tiers  | 1    | A (step A2)     |
| 1.2 Raised-cosine limit curve punishes legitimate angles   | 1    | A (step A3)     |
| 1.3 Symmetry guard miscalibrated                           | 1    | A (step A4)     |
| 2.1 Scatter-IDW → grid-aware bilinear interpolation        | 2    | D               |
| 2.2 Normalisation contaminated by low-confidence estimates | 2    | A (step A2)     |
| 2.3 Fragile 80 %-of-leader selection threshold             | 2    | A (step A5)     |
| 2.4 Zone-specific confidence thresholds                    | 2    | A (step A1)     |
| 3.1 Per-leg-card live queries                              | 3    | B               |
| 3.2 Leftover debug logging                                 | 3    | 0               |
| 3.3 Reasoning data never surfaced                          | 3    | C               |
| 4.x Two-phase mutation / type split                        | 4    | A (ride-along)  |
| 4.x Scattered tuning constants                             | 4    | A (step A1)     |
| 4.x Guard interface widening                               | 4    | A (step A4)     |
| 4.x `hasLimits` can lie                                    | 4    | A (ride-along)  |
| 4.x Barrel-import violation                                | 4    | 0               |
| 4.x `interpolateTwaLimits` ordering precondition           | 4    | A (ride-along)  |
| 4.x Test gaps (scenario table, negative leader, guards)    | 4    | A (test gate)   |

## Status

| Package | Status      |
| ------- | ----------- |
| 0       | Not started |
| A       | Not started |
| B       | Not started |
| C       | Not started |
| D       | Not started |

Update this table as packages land (link the PR/commit).
