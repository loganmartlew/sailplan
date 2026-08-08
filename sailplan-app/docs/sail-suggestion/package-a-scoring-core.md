# Package A — Scoring core (implementation plan)

> Covers findings **1.1, 1.2, 1.3, 2.2, 2.3, 2.4** plus the Tier-4
> ride-alongs (type split, guard context, config consolidation, `hasLimits`,
> ordering precondition) from [`improvements.md`](./improvements.md).
>
> **This package ships as one unit.** Every step changes the same score space;
> calibrating any one constant only makes sense against the others. Do not
> split it across PRs. Internally it is still built as ordered commits
> (A1 → A5) so review can follow the reasoning.

## Goals

1. Every sail's `rankingScore` lands on **one continuous 0–~1.05 scale**,
   regardless of how much polar data it has. No cliffs at confidence
   thresholds; a small confidence wobble may move a score by ~0.02, never
   by ~0.2.
2. A sail with real polar evidence **never loses to an equally-good sail with
   no data** ("the engine rewards having less data" is fixed), while the
   limits-fallback philosophy survives: with no polars, ranking is by limits
   exactly as today.
3. In-window TWA angles are **not punished for being off-centre** — an asym at
   the deep edge of its window scores near 1.0, not ~0.07. In-range always
   beats out-of-range by a margin.
4. The symmetry guard becomes a **nudge, not a veto**: its maximum influence
   (~0.2) is a fraction of the score scale, and normal crossover angles
   (150–170°) are not penalised at all.
5. Selection is robust for **negative and near-zero leaders**, and the result
   tells the UI when the picks are a least-bad fallback rather than a
   confident suggestion.
6. All tuning constants live in **one config object**, threaded explicitly so
   the pipeline stays pure and unit-testable, and can later be user-adjusted.
7. `rankSails` returns **new records of a distinct type** — no more in-place
   mutation of placeholder fields.

## Non-goals

Interpolation changes (Package D), data-fetch changes (Package B), any UI
beyond keeping the existing badge rendering compiling (Package C).

---

## The gate: scenario test table (write FIRST)

**New file:** `features/sailSuggestion/util/__tests__/scenarios.test.ts`

Written and agreed **before any implementation code**. Each scenario builds a
small fleet with `suggestSails` (public API only) and asserts *which sail
wins* / ordering properties — never exact scores, so the table survives
constant tuning. This table is also where the open calibration decisions
(ε, dead band, guard-skip, margin — see the end of this doc) get settled
against concrete outcomes.

Shared fixtures: a dense polar grid helper
`makeGrid(twsValues, twaValues, speedFn)` (mirrors what `polars/` emits) and a
limits helper `makeLimits(rows)`.

| #  | Scenario                                                                                                       | Assertion                                                                    | Guards which fix |
| -- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- |
| S1 | Symmetric runner (dense polars, fastest) vs asym at TWA 170°, TWS 15                                           | Runner wins; asym not penalised into last place                              | 1.3 dead band    |
| S2 | Asym (dense polars) vs symmetric runner at TWA 140°, TWS 12                                                    | Asym wins; runner's guard penalty ≤ 0.2 total                                | 1.3 cap/slope    |
| S3 | **Limits-only kite** (no polars, well-centred window) vs **polars-proven kite** (dense polars, in-window limits) | Polars-proven kite wins                                                       | 1.1 ε bonus      |
| S4 | Same as S3 but the proven kite's polars are *patchy* (moderate confidence)                                     | Proven kite still wins                                                        | 1.1 defect 2     |
| S5 | All sails outside their TWA limits (negative leader)                                                            | `suggested` non-empty, leader is the least-bad sail, result flagged fallback | 2.3              |
| S6 | Sparse-data fleet: every sail low-confidence, all with limits                                                   | Ranking follows limit fit exactly (pure-limits fallback preserved)            | 1.1 convergence  |
| S7 | Confidence wobble: identical fleet evaluated with one polar point added/removed so one sail's confidence moves ~0.34 → ~0.36 | Winner and ordering unchanged                                    | 1.1 defect 1     |
| S8 | Zone boundary: same fleet at TWA 79.9° vs 80.1° and 149.9° vs 150.1°                                           | Ordering unchanged (zones no longer branch the math)                          | 2.4              |
| S9 | Identical polars, differentiated only by limits: sail A in-window centre, sail B at window edge, sail C outside | Order A ≥ B > C, and B's score close to A's (edge not punished)               | 1.2 trapezoid    |
| S10| Asym with user limits `maxTwa = 175` sailed at TWA 172°                                                         | Not out-ranked by an unlimited sail purely via the symmetry guard             | 1.3 open decision |
| S11| Monotonicity probe: raise one sail's polar speeds so its polarScore rises (limitScore fixed, higher)            | Its rank never *drops* (kills the moderate-tier "signals fight" defect)       | 1.1 defect 2     |
| S12| No polars, no limits fleet                                                                                      | `suggested` empty, all scores −∞ (behaviour preserved)                        | regression       |

---

## Step A1 — Config consolidation (prep commit, no behaviour change except 2.4)

**New file:** `features/sailSuggestion/model/suggestionConfig.ts`
(`model/` already holds constant values — `CONFIDENCE_THRESHOLDS` — so this
follows precedent.)

```ts
import type { InterpolationConfig } from '~/features/sailPolar';

export interface SuggestionConfig {
  /** Continuous confidence blend (step A2). */
  blend: {
    /** Confidence at/below which ranking is pure limits (w = 0). */
    lowConfidence: number; // 0.25
    /** Confidence at/above which ranking is pure polars (w = 1). */
    highConfidence: number; // 0.70
    /** ε — evidence tiebreaker multiplied by raw confidence. */
    evidenceBonus: number; // 0.05
  };
  /** Trapezoid limit curve (step A3). */
  limitCurve: {
    /** Fraction of the half-window that scores a flat 1.0. */
    plateauFraction: number; // 0.7
    /** Score at the window edge (in-range floor). */
    edgeScore: number; // 0.3
    /** Floor for out-of-range angles. */
    outsideFloor: number; // -0.5
    /** Synthetic half-window for one-sided limits (degrees). */
    oneSidedOffsetDeg: number; // 20
  };
  /** Symmetry guard (step A4). */
  symmetryGuard: {
    /** No penalty for either symmetry inside this TWA band. */
    deadBandMinTwa: number; // 150
    deadBandMaxTwa: number; // 170
    penaltyPerDegree: number; // 0.01
    maxPenalty: number; // 0.2
    /** Open decision: trust user limits over the guard. Settled via S10. */
    skipWhenLimitsDefined: boolean;
  };
  /**
   * Display-only tier labels after A2 (single set — zone-specific thresholds
   * collapsed per finding 2.4). `moderate` doubles as the normalisation gate
   * for maxSpeed (finding 2.2).
   */
  confidenceTiers: { high: number; moderate: number }; // 0.65 / 0.35
  /** Suggestion selection (step A5). */
  selection: {
    /** Additive margin below the leader's score. */
    margin: number; // 0.15
    maxSuggested: number; // 3
    /** Leader score below which the result is flagged as a fallback pick. */
    fallbackScoreFloor: number; // 0
  };
  /** Overrides passed through to sailPolar's estimateSailSpeed. */
  interpolation?: Partial<InterpolationConfig>;
}

export const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig = { /* values above */ };
```

### Constant inventory (what moves where)

| Today                                                            | Becomes                                  |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `rankSails.ts` → `SUGGESTED_THRESHOLD = 0.8` (multiplicative)    | `selection.margin = 0.15` (additive, A5) |
| `rankSails.ts` → `MAX_SUGGESTED = 3`                             | `selection.maxSuggested`                 |
| `limitScoring.ts` → `ONE_SIDED_OFFSET = 20`                      | `limitCurve.oneSidedOffsetDeg`           |
| `limitScoring.ts` → `OUTSIDE_FLOOR = -0.5`                       | `limitCurve.outsideFloor`                |
| `confidenceTier.ts` → `CONFIDENCE_THRESHOLDS` (per-zone record)  | `confidenceTiers` (single set)           |
| `symmetryGuard.ts` → `THRESHOLD_TWA/PENALTY_PER_DEGREE/MAX_PENALTY` | `symmetryGuard.*` (recalibrated, A4)  |
| sailPolar `DEFAULT_INTERPOLATION_CONFIG`                         | **stays in sailPolar** (it's that feature's own default); `interpolation` carries per-caller overrides |

### Threading

Add an optional trailing parameter through the pure pipeline, defaulting to
the exported default so no caller changes:

```ts
suggestSails(twa, tws, sails, allPolars, allLimits, config = DEFAULT_SUGGESTION_CONFIG)
  → evaluateSail(sail, twa, tws, polars, limits, guards, config)
  → rankSails(evaluations, config)
```

`evaluateSail` passes `config.interpolation` to `estimateSailSpeed`. Tests can
inject a custom config; a future settings screen constructs one from stored
prefs. **Do not** read config from module-level mutable state — keep the
functions pure.

### Collapse zone thresholds (2.4)

- `classifyConfidence(confidence, zone)` → `classifyConfidence(confidence,
  thresholds)` — the `WindZone` parameter is removed; the per-zone
  `CONFIDENCE_THRESHOLDS` record is deleted.
- Adopt the downwind set (`high: 0.65, moderate: 0.35`) as the single default —
  the app's primary zone, and the middle of the current three sets.
- `getWindZone` / `windZone` stay: still shown in the UI (`conditions`), still
  available to guards via the A4 context object.
- Barrel (`index.ts`): remove the `CONFIDENCE_THRESHOLDS` /
  `ConfidenceThresholds` exports; export `SuggestionConfig` /
  `DEFAULT_SUGGESTION_CONFIG` instead.
- Update `evaluateSail` tests that assert zone-specific tier boundaries.

## Step A2 — Continuous confidence blend (finding 1.1) + gated normalisation (2.2)

**File:** `util/rankSails.ts` (rewrite of steps 1–2).

### Normalisation gate (2.2)

```ts
const trusted = evaluations.filter(
  e => e.predictedSpeed !== null && e.predictedSpeed > 0
    && e.confidence >= config.confidenceTiers.moderate,
);
const pool = trusted.length > 0 ? trusted : evaluations;
const maxSpeed = max over pool of predictedSpeed (as today);
```

One garbage low-confidence over-estimate no longer deflates every trustworthy
sail's `polarScore`. (A low-confidence sail can now have `polarScore > 1`; the
blend gives it near-zero polar weight, so that's harmless — note this in a
code comment since it's a non-obvious invariant.)

### The blend

```ts
function smoothstep(x: number, e0: number, e1: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const w = smoothstep(confidence, blend.lowConfidence, blend.highConfidence);
```

Per-sail score, replacing the tier `switch` entirely:

| `polarScore` | `limitScore` | `rankingScore`                                                    | recorded weights          |
| ------------ | ------------ | ------------------------------------------------------------------ | ------------------------- |
| present      | present      | `w·polarScore + (1−w)·limitScore + ε·confidence − guardPenalty`   | `polar: w, limit: 1−w`    |
| present      | `null`       | `w·polarScore + ε·confidence − guardPenalty`                       | `polar: w, limit: 0`      |
| `null`       | present      | `limitScore − guardPenalty` (w forced to 0; ε contributes ~0)      | `polar: 0, limit: 1`      |
| `null`       | `null`       | `−Infinity` (unrankable, excluded — as today)                      | `polar: 0, limit: 0`      |

- `ε = blend.evidenceBonus (0.05)` — the **evidence tiebreaker**: when a
  limits-only sail and a polars-proven sail are otherwise equal, the measured
  one wins. This is the one deliberate behavioural change vs. the old design.
- Convergence: `confidence ≥ 0.70` → `w = 1`, polars dominate (old high tier);
  `confidence ≤ 0.25` → `w = 0`, pure limits (old low tier). The fallback
  philosophy is intact.
- `confidenceTier` is still computed in `evaluateSail` — **as a display label
  only**. Nothing in `rankSails` may branch on it.

Worked check (S7): polarScore 1.0, limitScore 0.5 — confidence 0.34 scores
≈ 0.57, confidence 0.36 scores ≈ 0.59. The old formulas scored these 0.50 vs
0.68. The 0.18 cliff becomes ~0.02.

Coupling note (why A2 and A3 ship together): in S3/S4 the ε bonus only
reliably beats the limits-only sail once the trapezoid stops deflating the
proven sail's in-window `limitScore` — under the old bell curve a mid-window
limit of 0.6 vs 0.95 swamps ε. Calibrate ε **after** A3 lands in the branch.

### Ride-along: type split (Tier 4)

**Files:** `model/sailEvaluation.ts`, `model/sailSuggestion.ts`,
`util/evaluateSail.ts`, `util/rankSails.ts`, barrel, `CourseLegCard`.

```ts
// evaluate-time record — no ranking placeholders anymore
export interface SailEvaluation {
  sail; predictedSpeed; confidence; confidenceTier; windZone;
  limitScore; hasLimits; limitsExceeded;
  guards: SuggestionGuardResult[];
  reasoning: EvaluationReasoning; // polarUsed, limitUsed, guardPenaltyTotal, pointsUsed
}

// ranking-time record — new object, produced (not mutated) by rankSails
export interface RankedSailEvaluation extends SailEvaluation {
  polarScore: number | null;
  rankingScore: number;
  reasoning: RankedEvaluationReasoning; // adds polarWeight, limitWeight
}
```

`rankSails(evaluations, config): { ranked: RankedSailEvaluation[]; suggested:
RankedSailEvaluation[]; isFallback: boolean }` builds each ranked record with
a spread (`{ ...evaluation, polarScore, rankingScore, reasoning: { ...r, … } }`)
— input records are never written to, and `evaluations`/`ranked` no longer
share references. `SailSuggestionResult.evaluations/suggested` become
`RankedSailEvaluation[]`. The placeholder comments and fields
(`polarScore: null`, `rankingScore: 0`, zeroed weights) are deleted from
`evaluateSail`.

### Ride-along: `hasLimits` derivation (Tier 4)

In `evaluateSail`, replace `const hasLimits = limits.length > 0` with:

```ts
const { minTwa, maxTwa } = interpolateTwaLimits(tws, limits);
const hasLimits = minTwa !== null || maxTwa !== null;
```

Rows with null min *and* max no longer yield `hasLimits: true` alongside
`limitScore: null`. `reasoning.limitUsed` derives from the same flag.

### Ride-along: ordering precondition (Tier 4)

Document on `interpolateTwaLimits` that callers pass rows ordered by `tws`
(the query in `api/getSailSuggestionData.ts` already orders by
`sailTwaLimit.tws`), keep the defensive re-sort, and note it exists only to
tolerate unordered ad-hoc callers/tests. Comment-only change.

## Step A3 — Trapezoid limit curve (finding 1.2)

**File:** `util/limitScoring.ts` → `computeLimitScore`, same signature plus
the config's `limitCurve` (pass as a parameter, threaded from `evaluateSail`).

Window derivation (two-sided / one-sided / degenerate `min === max`) is
unchanged from today. The shape over `t = |twa − center| / halfRange`
changes:

```
t ∈ [0, plateauFraction]      → 1.0                                (flat top)
t ∈ (plateauFraction, 1]      → 1.0 → edgeScore, linear taper:
                                 1 − (t − pf)/(1 − pf) · (1 − edgeScore)
t > 1 (outside the window)    → max(outsideFloor, −0.5·(t − 1))    (unchanged)
```

- With defaults (pf 0.7, edge 0.3): flat 1.0 across the middle 70 % of the
  window; the edge scores 0.3.
- **Deliberate discontinuity at the edge** (0.3 inside → 0 just outside):
  this *is* the "in-range always beats out-of-range by a margin" requirement.
  Comment it so nobody "fixes" the continuity.
- Worked check (drives S9 and the doc's headline case): asym limits
  100°–160°, TWA 155° → t ≈ 0.833 → score ≈ **0.69** (was 0.07). Upwind
  analogue 30°–90° at 38° → ≈ 0.92 (was 0.07).
- One-sided windows reuse the same shape with
  `halfRange = oneSidedOffsetDeg`.
- `interpolateTwaLimits` is untouched (its tests all stand).

**Test rewrite:** the `computeLimitScore` cases asserting bell-curve values
(≈1.0 near centre only, ≈0 at edge, "confirms bell-curve shape") are replaced
with: plateau breadth (1.0 at t = 0 and t = 0.7), taper endpoints (edge =
`edgeScore`), the edge margin (score at t = 1 > score at t = 1 + δ), outside
decay/floor (unchanged expectations), one-sided and null cases (carry over).

## Step A4 — Guard recalibration (finding 1.3) + context object (Tier 4)

**Files:** `model/guard.ts`, `util/evaluateSail.ts`,
`util/guards/symmetryGuard.ts`, `util/guards/guardRegistry.ts`.

### Widen the interface first (one guard exists — migrate it now, cheaply)

```ts
export interface GuardContext {
  sail: Sail;
  twa: number;
  tws: number;
  windZone: WindZone;
  /** Interpolated at the current TWS; nulls when undefined. */
  limits: InterpolatedLimits;
  hasLimits: boolean;
  /** Raw polar confidence for this sail (0–1). */
  confidence: number;
  config: SuggestionConfig;
}

export interface SuggestionGuard {
  name: string;
  evaluate(ctx: GuardContext): SuggestionGuardResult | null;
}
```

In `evaluateSail`, guards already run last (step 5), after interpolation and
limit scoring — build the context from those results. No ordering change.

### Recalibrate `symmetryGuard`

```ts
const { deadBandMinTwa, deadBandMaxTwa, penaltyPerDegree, maxPenalty,
        skipWhenLimitsDefined } = ctx.config.symmetryGuard;

if (skipWhenLimitsDefined && ctx.hasLimits) return null;

if (sail.symmetrical && twa < deadBandMinTwa) {
  penalty = Math.min((deadBandMinTwa - twa) * penaltyPerDegree, maxPenalty);
}
if (!sail.symmetrical && twa > deadBandMaxTwa) {
  penalty = Math.min((twa - deadBandMaxTwa) * penaltyPerDegree, maxPenalty);
}
```

- Dead band 150°–170°: no penalty for either symmetry — covers normal
  crossover angles (shy runner, soaked asym). The old hard cliff at exactly
  160° is gone.
- Slope 0.01/°, cap 0.2: sized against the ~1.05 score scale — a nudge
  (max ≈ 19 % of scale), not the old veto (0.05/° capped at 1.0, which
  exceeded the whole polar-score range).
- Worked checks: symmetric runner at 140° → 0.10 (was 1.0); asym at 165° → 0
  (was 0.25); asym at 180° → 0.10 (was 1.0).
- `symmetrical: false` still proxies "asymmetric kite" for jibs/mains
  (schema default) — accepted for a downwind-focused fleet; with the cap at
  0.2 the worst-case misfire is now small. `sailType` column remains
  deferred future work.
- **Open decision** `skipWhenLimitsDefined`: settled by scenario S10. Start
  with `true` (user-entered limits are strictly better evidence than the
  hardcoded heuristic); flip if S10/S1 outcomes argue otherwise.

**Test rewrite:** `symmetryGuard.test.ts` re-pins the new numbers: null inside
the dead band for both symmetries (150/160/170), slope/cap values on either
side, and the `skipWhenLimitsDefined` short-circuit.

## Step A5 — Additive selection margin + fallback flag (finding 2.3)

**File:** `util/rankSails.ts` step 4.

```ts
const eligible = ranked.filter(e => e.rankingScore > -Infinity);
if (eligible.length === 0) return { ranked, suggested: [], isFallback: false };

const leaderScore = eligible[0].rankingScore;
const suggested = eligible
  .filter(e => e.rankingScore >= leaderScore - config.selection.margin)
  .slice(0, config.selection.maxSuggested);

const isFallback = leaderScore < config.selection.fallbackScoreFloor;
```

- The leader always satisfies its own margin, so the silent
  `suggested.length === 0 → slice(0, 1)` fallback branch is **deleted** —
  negative and zero leaders now work by construction (S5).
- Margin 0.15 is *additive*: on the normalised score it reads "within ~15 % of
  the best boat speed", and it behaves identically across the whole score
  range. It is the **last knob calibrated** in this package (it depends on how
  scores distribute under A2–A4).
- `isFallback` (leader below `fallbackScoreFloor = 0`, i.e. even the best sail
  is outside its limits / penalised) is added to `SailSuggestionResult` so
  Package C can render "least-bad guess" differently from a confident pick.
  A negative-leader unit test pins it.

## Test migration summary

| Existing test file            | Fate                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `rankSails.test.ts`           | Per-tier formula tests **replaced** (they pin the old `switch`); keep/port: −∞ exclusion, max-3 cap, sort order, empty-suggested. Add: gated normalisation, blend truth table, additive margin, negative-leader + `isFallback`, no-mutation assertion (input records unchanged, `ranked[i] !== evaluations[j]`). |
| `limitScoring.test.ts`        | `interpolateTwaLimits` suite untouched; `computeLimitScore` suite rewritten for the trapezoid (see A3). |
| `symmetryGuard.test.ts`       | Rewritten for dead band / slope / cap / skip flag (see A4).              |
| `evaluateSail.test.ts`        | Mostly stands; tier-classification cases updated for the single threshold set; placeholder-field assertions (`polarScore: null`, `rankingScore: 0`) removed with the type split. |
| `suggestSails.test.ts`        | Integration cases re-validated; several overlap the scenario table and can migrate into it. |
| `scenarios.test.ts` (**new**) | The S1–S12 gate table. Written first; must pass before merge; becomes the permanent regression harness for Package D. |

## Acceptance criteria

- [ ] Scenario table S1–S12 green.
- [ ] `rankingScore` is continuous in confidence: property check sweeping
      confidence 0→1 in 0.01 steps produces score deltas < 0.02 per step
      (fixed polar/limit inputs).
- [ ] No `switch (confidenceTier)` (or any tier branch) remains in ranking
      code; tiers appear only in display data.
- [ ] `rankSails` does not mutate its input (frozen-object test).
- [ ] All tuning constants referenced from `DEFAULT_SUGGESTION_CONFIG`; no
      magic numbers left in `rankSails` / `limitScoring` / `symmetryGuard` /
      `confidenceTier`.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npx jest` clean.
- [ ] Feature README updated: pipeline description (blend formula, trapezoid,
      guard numbers, selection rule), key-types section
      (`RankedSailEvaluation`, `isFallback`), file map
      (`suggestionConfig.ts`).

## Files touched

```
features/sailSuggestion/
├── index.ts                          exports: +SuggestionConfig/DEFAULT, +RankedSailEvaluation,
│                                     −CONFIDENCE_THRESHOLDS/ConfidenceThresholds
├── model/
│   ├── suggestionConfig.ts           NEW
│   ├── confidenceTier.ts             single threshold set; zone param dropped
│   ├── guard.ts                      GuardContext
│   ├── sailEvaluation.ts             type split
│   └── sailSuggestion.ts             RankedSailEvaluation[], isFallback
├── util/
│   ├── suggestSails.ts               config threading, isFallback passthrough
│   ├── evaluateSail.ts               hasLimits fix, guard context, no placeholders
│   ├── rankSails.ts                  rewrite (A2 + A5)
│   ├── limitScoring.ts               trapezoid (A3), precondition note
│   └── guards/symmetryGuard.ts       recalibration (A4)
└── util/__tests__/                   scenarios.test.ts NEW + rewrites above
features/plan/components/CourseLegCard.tsx   type name only (SailEvaluation → RankedSailEvaluation)
features/sailSuggestion/README.md            updated to describe the new engine
```

## Open decisions (settle inside this package, via the scenario table)

| Decision                         | Default to start | Settled by |
| -------------------------------- | ---------------- | ---------- |
| ε (evidence bonus) magnitude     | 0.05             | S3, S4, S6 |
| Guard dead-band edges            | 150° / 170°      | S1, S2     |
| `skipWhenLimitsDefined`          | `true`           | S10        |
| Selection margin                 | 0.15             | S5, S9 + fleet-level sanity (typical suggested count 1–3, not always 3) |
