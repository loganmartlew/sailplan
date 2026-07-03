# Sail Suggestion Pipeline

Given a true wind angle (TWA) and true wind speed (TWS), the suggestion engine
ranks every sail in the active boat profile and returns up to 3 top picks.

## Entry points

| Export                                                | Purpose                                         |
| ----------------------------------------------------- | ----------------------------------------------- |
| `suggestSails(twa, tws, sails, allPolars, allLimits)` | Pure function — core pipeline                   |
| `useSailSuggestionData(boatProfileId)`                | React hook — fetches sails/polars/limits once   |
| `useSailSuggestions(data, twa, tws)`                  | React hook — pure `suggestSails` compute (memo) |

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
 │    1. Normalise polar scores
 │    2. Compute ranking score (tier-dependent blend)
 │    3. Sort descending
 │    4. Select suggestions (within 80 % of leader, max 3)
 │
 └─ return SailSuggestionResult { evaluations, suggested, conditions }
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

The raw confidence value is bucketed into a discrete tier using zone-specific
thresholds:

| Zone     | High ≥ | Moderate ≥ | Low    |
| -------- | ------ | ---------- | ------ |
| upwind   | 0.70   | 0.40       | < 0.40 |
| reaching | 0.60   | 0.30       | < 0.30 |
| downwind | 0.65   | 0.35       | < 0.35 |

The tier drives how polar vs. limit scores are blended during ranking.

### 4. TWA limit scoring

Each sail can have min/max TWA boundaries defined at discrete TWS values.
`interpolateTwaLimits` linearly interpolates these to the current TWS (clamping
when outside the defined range).

`computeLimitScore` then evaluates how well the requested TWA fits:

- Raised-cosine bell curve centred on the midpoint of [minTwa, maxTwa].
- Score = **1.0** at the centre (ideal angle), tapering to **0.0** at the
  edges, then decaying linearly to a floor of **−0.5** outside the limits.
- One-sided limits (only min or only max) assume a synthetic range using a
  fixed 20° offset.
- Returns `null` when no limits are defined.

### 5. Guards

Guards are pluggable penalty functions. Each guard inspects the sail and
conditions and may return a `{ penalty, reason }`. Penalties are subtracted
from the ranking score.

Currently registered (via `guardRegistry`):

- **symmetryGuard** — penalises symmetric sails at TWA < 160° and asymmetric
  sails at TWA > 160°. Penalty = 0.05 per degree past the threshold, capped
  at 1.0.

To add a guard: implement the `SuggestionGuard` interface and append it to the
`suggestionGuards` array in `util/guards/guardRegistry.ts`.

## Phase 2 — Ranking & selection (`rankSails`)

### 1. Normalise polar scores

Each sail's predicted speed is divided by the fastest sail's speed, producing
a 0–1 `polarScore`.

### 2. Compute ranking score

Blending strategy varies by confidence tier:

| Tier         | Formula                                                | Rationale                                  |
| ------------ | ------------------------------------------------------ | ------------------------------------------ |
| **High**     | `polarScore + 0.1 × max(limitScore, 0) − guardPenalty` | Trust polars; limits are a small bonus     |
| **Moderate** | `c × polarScore + (1 − c) × limitScore − guardPenalty` | Blend proportionally to raw confidence `c` |
| **Low**      | `limitScore − guardPenalty` (or −∞ if no limits)       | Polars too sparse to trust                 |

The corresponding `polarWeight` and `limitWeight` are written into the
evaluation's `reasoning` for auditability.

### 3. Sort & select

- Sort all evaluations descending by `rankingScore`.
- Select sails scoring within 80 % of the leader's score.
- Return 0–3 suggestions. If no sail has a finite ranking score, the suggested
  list is empty; otherwise the result is capped at 3. Sails with −∞ scores are
  excluded.

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
├── evaluations: SailEvaluation[]   // all sails, sorted
├── suggested:   SailEvaluation[]   // top 1–3 picks
└── conditions:  { twa, tws, windZone }

SailEvaluation
├── sail, predictedSpeed, confidence, confidenceTier, windZone
├── limitScore, hasLimits, limitsExceeded
├── polarScore, rankingScore
├── guards: SuggestionGuardResult[]
└── reasoning: EvaluationReasoning { polarUsed, limitUsed, polarWeight,
│                                     limitWeight, guardPenaltyTotal,
│                                     pointsUsed }
```

## File map

```
sailSuggestion/
├── index.ts                        public exports
├── api/
│   └── getSailSuggestionData.ts    Drizzle queries → SailSuggestionData
├── hooks/
│   └── useSailSuggestions.ts       React hook (pure suggestSails compute)
├── model/
│   ├── confidenceTier.ts           tier thresholds & classifyConfidence
│   ├── guard.ts                    SuggestionGuard / GuardResult interfaces
│   ├── sailEvaluation.ts           SailEvaluation & EvaluationReasoning
│   ├── sailSuggestion.ts           SailSuggestionResult
│   └── windZone.ts                 WindZone type & getWindZone
└── util/
    ├── suggestSails.ts             pipeline entry point
    ├── evaluateSail.ts             per-sail evaluation (phase 1)
    ├── rankSails.ts                normalisation & selection (phase 2)
    ├── limitScoring.ts             interpolateTwaLimits, computeLimitScore
    └── guards/
        ├── guardRegistry.ts        registered guards array
        └── symmetryGuard.ts        symmetric/asymmetric penalty
```
