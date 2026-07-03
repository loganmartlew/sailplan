# Sail Suggestion Engine — Improvement Plan

> Full findings from a top-to-bottom review of the suggestion pipeline
> (July 2026), refined against the product context below, and organised into
> work packages. The companion
> [feature README](../../features/sailSuggestion/README.md) documents how the
> engine works *today*; this document records what's wrong with it, why, and
> the agreed direction for fixing it. Each work package has a detailed
> implementation plan — see the [plan index](./README.md).

## Product context that shaped this plan

- **The app is primarily for selecting downwind sails** (symmetric and
  asymmetric kites, code zeros). Jibs and mainsails are generally not of
  interest. This kept the symmetry guard (it distinguishes exactly the sails
  that matter), demoted the sail-type column to optional, and deprioritised
  upwind zone-boundary tuning.
- **The confidence-tier fallback philosophy is deliberate**: when polar data
  for a sail is sparse, the engine should lean on the user-entered TWA limits
  instead. The redesign below *keeps* that philosophy — it removes the cliffs
  and scale mismatches in how it's implemented, not the fallback itself.

## Overall verdict

The pipeline's *structure* is good: evaluate → rank → select, with reasoning
captured per sail for auditability. The problems are concentrated in the
scoring math (three genuine design flaws that produce wrong suggestions in
realistic scenarios) and in the UI integration (a real performance problem).

---

## Tier 1 — Design flaws that produce wrong suggestions

### 1.1 Ranking scores are not comparable across confidence tiers

**Where:** `util/rankSails.ts` (the per-tier `switch` in step 2).

Each sail's `rankingScore` is computed with a *different formula* depending on
that sail's own confidence tier, and then all sails are sorted on one axis:

| Tier     | Formula                                    | Effective range |
| -------- | ------------------------------------------ | --------------- |
| high     | `polarScore + 0.1·max(limitScore, 0)`      | 0 – 1.1         |
| moderate | `c·polarScore + (1−c)·limitScore`          | varies with `c` |
| low      | `limitScore` (or −∞ with no limits)        | −0.5 – 1.0      |

The fallback *intent* is sound. The implementation has two concrete defects:

**Defect 1 — cliffs at tier boundaries.** The formula switches discontinuously
as confidence crosses a threshold. Worked example (downwind zone, moderate
threshold 0.35, high threshold 0.65; a kite with polarScore 1.0, limitScore
0.5):

- Confidence **0.36** (moderate): `0.36·1.0 + 0.64·0.5 = 0.68`
- Confidence **0.34** (low): `0.5`
- → a 0.02 wobble in confidence (one polar point added or removed) moves the
  score by **0.18**, easily reordering the suggestions.

Same cliff at the high/moderate boundary:

- Confidence **0.66** (high): `1.0 + 0.1·0.5 = 1.05`
- Confidence **0.64** (moderate): `0.64·1.0 + 0.36·0.5 = 0.81`
- → a **0.24** jump.

**Defect 2 — the formulas produce numbers on different scales that get sorted
together.** The high tier can reach 1.1; the low tier tops out at 1.0; the
moderate tier *caps* a proven-fastest sail at `c + (1−c)·limitScore`. Worked
example: the fleet's fastest sail has decent-but-patchy polars (moderate tier,
c = 0.45, polarScore = 1.0, limitScore = 0.6) → score **0.78**. A sail with
*no polar data at all* but a well-centred TWA limit window (low tier,
limitScore = 0.95) → score **0.95** — and wins. The engine rewards having
less data. The moderate blend also means a sail's score can *drop* as its
polar score rises whenever its limit score is higher — the two signals fight.

**Agreed fix — make the blend continuous (the moderate tier already is):**

```
w            = smoothstep(confidence, low ≈ 0.25, high ≈ 0.70)
rankingScore = w·polarScore + (1−w)·limitScore + ε·confidence − guardPenalty
```

- At high confidence this converges to today's high tier (polars dominate).
- At low confidence it converges to today's low tier (pure limit ranking) —
  the fallback philosophy survives intact.
- In between there are no cliffs, and every sail lands on one 0–1 scale.
- `ε·confidence` (ε ≈ 0.05) is an **evidence tiebreaker**: a limits-only sail
  can still rank well, but it can't beat a sail with real polar evidence
  that's equally good. Rationale: limits assert "this sail is appropriate
  here"; polars *measure* "this sail is fast here" — when both claims are
  perfect, the measured one should edge out the asserted one. This is the one
  deliberate behavioural change from the current design.
- **Confidence tiers stay — as display labels only** (high/moderate/low badge
  in the UI). They stop being branches in the math.

Null handling carries over: no polars → `w = 0` (pure limits); no limits →
`w·polarScore`; neither → excluded (−∞), as today.

### 1.2 The raised-cosine limit curve punishes legitimate angles

**Where:** `util/limitScoring.ts` → `computeLimitScore`.

The curve scores 1.0 at the *midpoint* of `[minTwa, maxTwa]` and ~0 at the
edges. But a TWA limit window is a "safe/appropriate to fly" range, not a
preference curve — the midpoint is not the ideal angle. This hits the downwind
use case directly:

- An asym with limits 100°–160° (midpoint 130°) sailed at **155°** — a normal
  deep VMG angle — scores `0.5·(1 + cos(π·25/30))` ≈ **0.07**, nearly
  identical to being *outside* its limits. Downwind, where the boat often sits
  at the deep edge of a sail's window, the bell curve systematically punishes
  the sails you actually want.
- (Upwind analogue, for completeness: a jib with limits 30°–90° beating at
  38° scores ≈ 0.07.)

A second inconsistency: the edge-of-range score (0.0) is *worse* than a
slightly-out-of-range sail can effectively score after other terms — in-range
should always beat out-of-range by a margin.

**Agreed fix — trapezoid:** flat 1.0 across the middle ~70 % of the window,
tapering to ~0.3 (not 0) at the edges, then the existing linear decay to the
−0.5 floor outside. The one-sided synthetic window (`ONE_SIDED_OFFSET = 20°`)
stays but becomes a named config knob.

### 1.3 The symmetry guard is miscalibrated and can fight the limit system

**Where:** `util/guards/symmetryGuard.ts`.

Original review found three problems; the downwind context revised the
conclusion from "delete it" to "keep it, recalibrate it":

1. **It misfires on non-spinnakers.** Every sail with `symmetrical: false` is
   treated as an asymmetric kite — and `symmetrical` defaults to `false` in
   `schema.ts`, so a jib or main at TWA 175° eats a 0.75 penalty for not
   being a symmetric spinnaker. *Downwind context:* if the boat profile is
   mostly kites, `symmetrical: false ≈ asym` is a fair proxy, so this drops in
   severity; a `sailType` column (main / headsail / asym / sym / code) becomes
   **optional future work** rather than a prerequisite.
2. **The penalty scale is uncalibrated.** 0.05/degree with a 1.0 cap means a
   symmetric kite at TWA 140° — a normal shy angle for a runner — is
   penalised by **more than the entire polar score range**, guaranteeing it
   ranks below sails that are out of their limits (floored at −0.5). Asyms hit
   a hard cliff at exactly 160°, yet an A3/A5 sails to 165–170°+ when soaked.
3. **It duplicates and can contradict the limit system.** TWA limits already
   express "don't fly this sail at this angle," per sail, per wind speed,
   entered by the user. The guard is a cruder hardcoded overlay that can fight
   user-entered limits.

**Agreed fix:** the guard should be a nudge, not a veto:

- slope ~**0.01/degree** (down from 0.05),
- cap ~**0.2** (down from 1.0), sized against the final score scale from 1.1,
- a **dead band ≈ 150°–170°** where neither symmetric nor asymmetric sails
  are penalised.
- **Open decision:** whether to skip the guard entirely for sails that have
  TWA limits defined (limits are better evidence). To be settled via the
  scenario test table (see Package A).

---

## Tier 2 — Algorithmic upgrades

### 2.1 Replace scatter-IDW with grid-aware bilinear interpolation

**Where:** `~/features/sailPolar/util/interpolation.ts`.

Polar data is inherently a grid (TWS columns × TWA rows — the `polars/`
generator emits exactly that). IDW over a scattered point cloud with `k = 6`,
`twaScale = 0.25`, `maxTwaDelta = 40°` has known pathologies here:

- It **plateaus at data points** — it can't represent the smooth speed curve
  between grid points and can't extrapolate a trend.
- The window admits points **40° away in TWA**; boat speed at TWA 60° vs 100°
  are different worlds. At `twaScale = 0.25`, 40° of TWA counts the same as
  10 kn of TWS — still inside the window.
- Prediction quality depends on accidental point density rather than on
  bracketing the target.
- Minor perf: `interpolateSpeed` recomputes the distances that
  `selectNearestPoints` already computed.

**Agreed fix:** bilinear interpolation on the two bracketing TWS columns and
two TWA rows — more accurate, cheaper, and it makes confidence almost trivial
(bracketed on both axes or not). Keep IDW only as a fallback for genuinely
scattered imports. **Minimal alternative** if bilinear is deferred: tighten
`maxTwaDelta` to ~15–20° and reuse the computed distances.

### 2.2 Normalisation denominator contaminated by low-confidence estimates

**Where:** `util/rankSails.ts` step 1.

`maxSpeed` is taken across **all** sails, including ones whose predicted speed
came from two far-away points with confidence 0.1. One garbage over-estimate
deflates every trustworthy sail's polarScore. **Fix:** compute `maxSpeed` from
sails at/above moderate confidence when any exist.

### 2.3 The 80 %-of-leader selection threshold is fragile

**Where:** `util/rankSails.ts` step 4 (`SUGGESTED_THRESHOLD = 0.8`).

A multiplicative threshold on a score that can be zero or negative
misbehaves:

- **Negative leader** (all sails out of limits): `leader × 0.8` is *above*
  the leader, the filter matches nothing, and the code silently falls into the
  `slice(0, 1)` fallback.
- **Leader near 0:** everything ties at the threshold.
- **Normalised clustering:** because polar scores are normalised to the
  leader, fleets cluster near 1.0, so "within 80 %" passes nearly everyone and
  the `MAX_SUGGESTED = 3` cap does all the real work.

**Agreed fix:** an **additive margin** — `score ≥ leaderScore − 0.15` — which
is robust across the whole score range and has a physical meaning (within
~15 % of best boat speed). Exact margin value is calibrated last in Package A.
Additionally: **flag fallback picks** in the result so the UI can distinguish
"confident pick" from "least-bad guess."

### 2.4 Zone-specific confidence thresholds add complexity without earning it

**Where:** `model/confidenceTier.ts`, `model/windZone.ts`.

- The per-zone thresholds differ by ±0.05 (high: 0.70 / 0.60 / 0.65) — within
  the noise of the confidence heuristic — yet create three extra tuning knobs
  and boundary discontinuities (identical data at TWA 79.9° vs 80.1° can
  change tier).
- `upwind < 80°` is generous (80° is nearly a beam reach; typical is 50–60°).

**Status: demoted** by the downwind focus and by 1.1 — once tiers are
display-only, zone thresholds stop affecting ranking entirely. Absorbed into
the config consolidation (Package A step 1): collapse to one threshold set
there. Possible future refinement: derive the upwind boundary from the boat's
actual polars (TWA of max VMG).

---

## Tier 3 — Performance & integration

### 3.1 Every leg card runs its own three live queries

**Where:** `features/plan/components/CourseLegCard.tsx` →
`useSailSuggestions` → `api/getSailSuggestionData.ts`.

Each `CourseLegCard` mounts **three `useLiveQuery` subscriptions** (sails,
polars, limits). A 10-leg course = 30 live SQLite subscriptions fetching
*identical* data, each re-running on any write to `sail` / `sailPolar` /
`sailTwaLimit`, plus 10 separate map-building passes. **Fix:** fetch once at
the course level (context provider or lift into `PlanCourse`) and pass the
data down; each card calls pure `suggestSails` in a `useMemo`. Single biggest
efficiency win available.

### 3.2 Leftover debug logging

`CourseLegCard.tsx` (~lines 102–115) contains a commented-out condition
wrapping a live `console.log` that `JSON.stringify`s the full suggestion
evaluations — including the `pointsUsed` polar arrays — on **every render of
every card**. Remove.

### 3.3 Reasoning data is computed but never surfaced

The engine records `confidenceTier`, `limitsExceeded`, guard reasons, and
polar/limit weights into `reasoning` — and the UI renders only the top sail's
name badge plus "+N more". **Fix:** tap a suggestion badge → a breakdown sheet
showing, per sail: polar/limit weights, confidence tier badge, guard reasons,
an "outside TWA limits" warning, and the fallback-pick marker from 2.3. Beyond
UX, this creates the on-device tuning loop that makes every Tier 1/2
calibration decision easier.

---

## Tier 4 — Code health

- **Two-phase mutation is error-prone.** `evaluateSail` returns records with
  placeholder `polarScore: null` / `rankingScore: 0` that `rankSails` mutates
  in place; consumers of a pre-ranking evaluation get lies, and `evaluations`
  / `ranked` share object references. **Fix:** split the type
  (`SailEvaluation` → `RankedSailEvaluation`) and have `rankSails` return new
  records.
- **Tuning constants are scattered across five files** (`rankSails`,
  `limitScoring`, `confidenceTier`, `symmetryGuard`, sailPolar's
  `DEFAULT_INTERPOLATION_CONFIG`). **Fix:** one `suggestionConfig.ts` —
  coherent tuning, testable as a unit, later user-adjustable.
- **Guard interface will need widening.** `evaluate(sail, twa, tws)` gives
  guards no access to wind zone, limits, or polar confidence. **Fix:** pass a
  context object (`{ sail, conditions, limits, evaluationSoFar }`) while
  there's still only one guard to migrate.
- **`hasLimits` can lie.** It's `limits.length > 0`, but rows can have null
  min *and* max, yielding `limitScore: null` with `hasLimits: true`.
  **Fix:** derive it from the interpolated result.
- **Barrel-import violation.** `CourseLegCard` imports
  `~/features/sailSuggestion/model/sailEvaluation` deep; re-export the type
  from the feature `index.ts`.
- **`interpolateTwaLimits` re-sorts per call** although the query already
  orders by `tws`. Document the ordering precondition during Package A; not
  worth standalone work.
- **Test gaps:** a cross-tier regression test encoding "sail with good polars
  beats sail with only limits" (would have caught 1.1), a negative-leader
  selection test (2.3), and kite-at-deep-TWA guard tests (1.3). The existing
  per-tier `rankSails` tests pin the formulas being replaced and are rewritten
  in Package A.

---

## Work packages

Grouping rule: the scoring changes share one score space — calibrating any one
depends on the others — so they ship as **one unit**. Everything else is
deliberately kept apart from that unit so diffs stay reviewable and bisectable.

### Package 0 — Immediate trivia (standalone, no design needed)

- Remove the `CourseLegCard` debug `console.log` block (3.2).
- Re-export `SailEvaluation` from the feature barrel; fix the deep import.

### Package A — Scoring core (one unit — do NOT split across PRs)

Internal order:

1. **Config consolidation** (prep commit): all tuning constants into
   `suggestionConfig.ts`; collapse zone-specific confidence thresholds to one
   set (2.4).
2. **Continuous confidence blend** in `rankSails` (1.1) — smoothstep weight,
   ε evidence bonus, tiers demoted to display labels. Includes the
   confidence-gated `maxSpeed` normalisation (2.2) — same function, same
   score space.
3. **Trapezoid limit curve** (1.2) — the blend's `(1−w)·limitScore` term is
   only trustworthy once the curve stops punishing in-window angles.
4. **Guard recalibration** (1.3) — penalty magnitude only makes sense
   relative to the final score scale, so it's tuned against steps 2–3.
5. **Additive selection margin** (2.3) — the margin depends on how scores
   distribute under the new formula; last knob in the package.

**Gate: a scenario test table written *before* the code.** ~8–10 "obviously
right" downwind cases asserting *which sail wins* (not exact scores):
symmetric runner at 170°, asym at 140°, limits-only kite vs. polars-proven
kite, all-sails-out-of-limits, sparse-data fleet, zone boundaries, identical
polars differentiated by limits/guards. The table is also where the open
decisions get settled against concrete outcomes:

- ε magnitude (evidence bonus),
- guard dead-band edges and whether the guard is skipped when limits exist,
- the additive selection margin value.

**Ride-along code health** (same files, near-zero extra cost): evaluated vs.
ranked type split; guard context-object signature; `hasLimits` derivation;
`interpolateTwaLimits` ordering precondition note.

### Package B — Data-fetch hoist (independent; can run in parallel with A)

Lift `useSailSuggestionData` to course level so N leg cards share one set of
live queries (3.1); cards call pure `suggestSails` in `useMemo`. Touches plan
+ sailSuggestion hooks only — zero overlap with the scoring files. Must **not**
be bundled with A.

### Package C — Reasoning UI (after A, not with it)

The breakdown sheet from 3.3, including the fallback-pick marker from 2.3.
Sequenced after A because it displays A's new weight fields; kept separate
because A is pure-function work verified by tests while C is UI work verified
on-device. Doing C immediately after A gives the on-device tuning loop before
touching interpolation.

### Package D — Interpolation upgrade (last, standalone)

Bilinear-on-grid with IDW fallback (2.1), or the minimal alternative
(tightened `maxTwaDelta`, reused distances). Deliberately **after** A and
never bundled with it: bilinear changes the confidence distribution, and doing
both at once makes it impossible to tell which change moved the rankings.
After A, the scenario table doubles as the regression harness — if bilinear
breaks a scenario, the interpolation is the cause.

### Dropped / demoted

- Zone boundary retuning & per-zone thresholds → config decisions inside A1,
  not separate work.
- `sailType` column → optional future work; a downwind-focused fleet makes the
  `symmetrical` flag an adequate proxy.
- `interpolateTwaLimits` re-sort → precondition note only.

### Recommended order

**0 → A → B → C → D**, with B free to slot anywhere. A is the only genuinely
coupled package.
