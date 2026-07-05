# Sail Suggestion Pipeline

Given a true wind angle (TWA) and true wind speed (TWS), the suggestion engine
ranks every sail in the active boat profile and returns up to 3 top picks.

## Entry points

| Export                                                          | Purpose                                         |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `suggestSails(twa, tws, sails, allPolars, allLimits, config?)`   | Pure function — core pipeline                   |
| `useSailSuggestionData(boatProfileId)`                          | React hook — fetches sails/polars/limits once   |
| `useSailSuggestions(data, twa, tws)`                            | React hook — pure `suggestSails` compute (memo) |

All tuning constants live in one place — `model/suggestionConfig.ts`
(`DEFAULT_SUGGESTION_CONFIG`) — and are threaded explicitly through the pure
pipeline (`suggestSails → evaluateSail → rankSails`). Pass a custom
`SuggestionConfig` to override; a future settings screen can build one from
stored prefs.

## Pipeline overview

```
suggestSails
 ├─ for each sail ── evaluateSail ──┐
 │                                   │
 │    1. Wind zone classification    │
 │    2. Polar interpolation (IDW)   │  → SailEvaluation (per sail)
 │    3. Confidence tier mapping     │
 │    4. TWA limit scoring           │
 │    5. Guard evaluation            │
 │                                   │
 ├─ rankSails ──────────────────────┘
 │    1. Normalise polar scores (against the trusted pool)
 │    2. Compute ranking score (one continuous confidence blend)
 │    3. Sort descending
 │    4. Select suggestions (additive margin from leader, max 3)
 │
 └─ return SailSuggestionResult { evaluations, suggested, isFallback, conditions }
```

## Phase 1 — Per-sail evaluation (`evaluateSail`)

### 1. Wind zone classification

TWA is mapped to a zone used later for confidence thresholds:

| Zone     | TWA range |
| -------- | --------- |
| upwind   | < 80°     |
| reaching | 80°–150°  |
| downwind | > 150°    |

### 2. Polar interpolation

`estimateSailSpeed` (from `sailPolar`) uses Inverse Distance Weighting (IDW) to
estimate boat speed from the sail's polar grid. It also returns a raw
`confidence` score (0–1) composed of:

- **Distance score (50 %)** — proximity of the nearest polar points to the
  target TWA/TWS, relative to the maximum search radius.
- **Point count score (30 %)** — how many of the k nearest neighbours were
  found vs. the maximum.
- **Coverage score (20 %)** — whether the found points bracket the target in
  both the TWS and TWA dimensions.

### 3. Confidence tier

The raw confidence value is bucketed into a discrete tier using a single
threshold set (`config.confidenceTiers`, default high ≥ 0.65 / moderate ≥ 0.35).

The tier is a **display label only** — nothing in ranking branches on it. The
continuous blend (below) reads the raw confidence directly. The `moderate`
threshold doubles as the normalisation gate (see ranking step 1).

### 4. TWA limit scoring

Each sail can have min/max TWA boundaries defined at discrete TWS values.
`interpolateTwaLimits` linearly interpolates these to the current TWS (clamping
when outside the defined range).

`computeLimitScore` then evaluates how well the requested TWA fits, treating
the window as a "safe to fly" range rather than a preference curve — so it is a
**trapezoid**, not a bell curve:

- Flat **1.0** across the middle `plateauFraction` (70 %) of the window — a sail
  sailed at the deep edge of its window is **not** punished for being
  off-centre.
- Linear taper from 1.0 down to `edgeScore` (**0.3**) between the plateau and
  the edge.
- Outside the window, linear decay to a floor of `outsideFloor` (**−0.5**).
- The step from 0.3 (just inside) to ~0 (just outside) is a deliberate
  discontinuity: in-range always beats out-of-range by a margin.
- One-sided limits (only min or only max) assume a synthetic range using
  `oneSidedOffsetDeg` (20°).
- Returns `null` when no limits are defined.

### 5. Guards

Guards are pluggable penalty functions. Each guard inspects the sail and
conditions and may return a `{ penalty, reason }`. Penalties are subtracted
from the ranking score.

Guards receive a full `GuardContext` (`{ sail, twa, tws, windZone, limits,
hasLimits, confidence, config }`), not just the raw angle.

Currently registered (via `guardRegistry`):

- **symmetryGuard** — a nudge, not a veto. Penalises symmetric sails below the
  dead band (`deadBandMinTwa` 150°) and asymmetric sails above it
  (`deadBandMaxTwa` 170°); the 150–170° band covers normal crossover angles and
  is penalty-free. Slope 0.01/°, capped at `maxPenalty` **0.2** — a fraction of
  the ~1.05 score scale. When `skipWhenLimitsDefined` (default `true`) and the
  sail has user-entered TWA limits, the guard defers to them entirely.

To add a guard: implement the `SuggestionGuard` interface and append it to the
`suggestionGuards` array in `util/guards/guardRegistry.ts`.

## Phase 2 — Ranking & selection (`rankSails`)

`rankSails` returns **new** `RankedSailEvaluation` records — it never mutates
the `SailEvaluation` inputs from `evaluateSail`.

### 1. Normalise polar scores

Each sail's predicted speed is divided by the fastest **trusted** sail's speed
(predicted speed > 0 and confidence ≥ the moderate threshold), producing a 0–1
`polarScore`. Gating the denominator stops a single low-confidence over-estimate
from deflating every trustworthy sail's score. A low-confidence sail may end up
with `polarScore > 1`, but the blend gives it near-zero polar weight, so that's
harmless.

### 2. Compute ranking score (continuous blend)

Every sail lands on **one continuous 0–~1.05 scale**, regardless of how much
polar data it has — no cliffs at tier boundaries:

```
w            = smoothstep(confidence, lowConfidence 0.25, highConfidence 0.70)
rankingScore = w·polarScore + (1−w)·limitScore + ε·confidence − guardPenalty
```

- At high confidence `w → 1` (polars dominate); at low confidence `w → 0` (pure
  limit ranking — the fallback philosophy survives intact).
- `ε·confidence` (ε = `evidenceBonus` 0.05) is an **evidence tiebreaker**: when
  a limits-only sail and a polars-proven sail are otherwise equal, the measured
  one edges out the asserted one.
- Null handling: no polars → `w = 0` (pure limits, `limitScore − guardPenalty`);
  no limits → `w·polarScore + ε·confidence − guardPenalty`; neither → −∞
  (excluded).

The resolved `polarWeight` (= `w`) and `limitWeight` (= `1 − w`) are written
into the ranked record's `reasoning` for auditability.

### 3. Sort & select

- Sort all evaluations descending by `rankingScore`.
- Select sails within an **additive margin** of the leader
  (`score ≥ leaderScore − margin`, default 0.15) — robust across the whole score
  range, including negative and near-zero leaders.
- Return 0–3 suggestions (capped at `maxSuggested`). If no sail has a finite
  ranking score, the suggested list is empty; sails with −∞ scores are excluded.
- `isFallback` flags a result whose leader scores below `fallbackScoreFloor`
  (0) — e.g. every sail is outside its limits — so the UI can show a least-bad
  guess differently from a confident pick.

## Reasoning UI

`SuggestionBreakdownDialog` (opened from a course leg card's suggestion row or
its trailing arrow button) is a pure display of one leg's
`SailSuggestionResult` — no queries of its own. It shows:

- **Conditions header** — TWA, TWS, wind zone (from `result.conditions`).
- A **"best available"** warning banner when `result.isFallback` (the leg
  card's badge row also switches to a muted outline badge with a
  "best available" caption).
- **Every evaluated sail** in rank order (`result.evaluations`), each as a
  `SailEvaluationCard`: colour-swatch name badge, a **Suggested** marker for
  sails in `result.suggested`, the confidence tier badge + raw value
  (`ConfidenceTierBadge`), ranking score, predicted speed, polar/limit scores
  with their resolved blend weights, an "Outside TWA limits" warning when
  `limitsExceeded`, and one line per guard result (reason + penalty).

Scores render to two decimals; angles/speeds go through `~/lib/format`.
`reasoning.pointsUsed` is deliberately **not** rendered (debug-grade,
unbounded length).

## Data layer

`useSailSuggestionData` runs three live Drizzle queries filtered by the active
boat profile and aggregates the results into `Map`s keyed by sail ID:

| Query  | Target table                       | Grouped into                  |
| ------ | ---------------------------------- | ----------------------------- |
| Sails  | `sail`                             | `Sail[]`                      |
| Polars | `sailPolar` (inner join `sail`)    | `Map<sailId, PolarPoint[]>`   |
| Limits | `sailTwaLimit` (inner join `sail`) | `Map<sailId, SailTwaLimit[]>` |

The two hooks are split so N callers can share one subscription: a screen
calls `useSailSuggestionData(boatProfileId)` **once** and passes the result
down; each consumer then calls `useSailSuggestions(data, twa, tws)`, a pure
`useMemo` wrapper around `suggestSails` with no queries of its own. This is
how `app/(plan)/course/plan.tsx` gives every `CourseLegCard` in a course
access to the same live data without each card mounting its own queries.

## Key types

```
SailSuggestionResult
├── evaluations: RankedSailEvaluation[]   // all sails, sorted
├── suggested:   RankedSailEvaluation[]   // top 1–3 picks
├── isFallback:  boolean                  // leader is a least-bad guess
└── conditions:  { twa, tws, windZone }

SailEvaluation                            // produced by evaluateSail
├── sail, predictedSpeed, confidence, confidenceTier, windZone
├── limitScore, hasLimits, limitsExceeded
├── guards: SuggestionGuardResult[]
└── reasoning: EvaluationReasoning { polarUsed, limitUsed, guardPenaltyTotal,
│                                     pointsUsed }

RankedSailEvaluation extends SailEvaluation  // produced by rankSails
├── polarScore, rankingScore
└── reasoning: RankedEvaluationReasoning     // + polarWeight, limitWeight
```

## File map

```
sailSuggestion/
├── index.ts                        public exports
├── api/
│   └── getSailSuggestionData.ts    Drizzle queries → SailSuggestionData
├── components/
│   ├── SuggestionBreakdownDialog.tsx  per-leg reasoning breakdown (dialog shell)
│   ├── SailEvaluationCard.tsx         one sail's breakdown block
│   └── ConfidenceTierBadge.tsx        tier → colour badge (+ raw value)
├── hooks/
│   └── useSailSuggestions.ts       React hook (pure suggestSails compute)
├── model/
│   ├── suggestionConfig.ts         SuggestionConfig & DEFAULT_SUGGESTION_CONFIG
│   ├── confidenceTier.ts           classifyConfidence (display label)
│   ├── guard.ts                    SuggestionGuard / GuardContext interfaces
│   ├── sailEvaluation.ts           SailEvaluation, RankedSailEvaluation
│   ├── sailSuggestion.ts           SailSuggestionResult
│   └── windZone.ts                 WindZone type & getWindZone
└── util/
    ├── suggestSails.ts             pipeline entry point
    ├── evaluateSail.ts             per-sail evaluation (phase 1)
    ├── rankSails.ts                normalisation & selection (phase 2)
    ├── limitScoring.ts             interpolateTwaLimits, computeLimitScore
    └── guards/
        ├── guardRegistry.ts        registered guards array
        └── symmetryGuard.ts        symmetric/asymmetric nudge
```
