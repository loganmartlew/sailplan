# Package F — Coverage-aware ranking (implicit TWA envelopes)

> Round-2 package from [`accuracy-review.md`](./accuracy-review.md), the fix for
> finding **R2.2** ("IDW extrapolation lets fast sails win at angles they can't
> sail") and the single biggest accuracy win of the round. When a sail has
> polar data but no explicit TWA limits, its own data coverage stands in as an
> implicit usable-range envelope: angles it was never logged at are scored as
> out-of-range rather than trusted extrapolations. Judged by Package E's
> harness — `noisy-log` wrong-leader **52.2 % → 2.2 %**.

## The problem it fixes

The engine treated absence of data at an angle as *"less confident —
extrapolate anyway."* A sail's edge-of-band measurements project up to
`maxTwaDelta` (40°) beyond its band at roughly edge speed, so whichever sail was
fastest *anywhere within ±40°* won, whether or not it can fly the target angle
(R2.2). And the confidence that was supposed to hold this back doesn't: a
one-sided extrapolation 20–35° outside a band still scores 0.6–0.85, which the
blend treats as `w ≈ 1` — full polar weight (R2.3).

The modelling correction: **absence of data at an angle is evidence the sail is
not flown there.** Product decision **D2** sanctions using a sail's observed
data band as its usable envelope when no explicit limits exist; explicit
user-entered limits always take precedence.

## What it does

Two moving parts, both in `evaluateSail` and one small pure helper — no changes
to `rankSails`, the blend, or the interpolation core.

1. **Derive an implicit envelope** — `util/coverageEnvelope.ts`
   (`deriveCoverageEnvelope`). From the sail's own polar points near the target
   TWS, take the trimmed-quantile TWA span and expand it by a margin. Shaped as
   `InterpolatedLimits` so it drops straight into the existing
   `computeLimitScore` trapezoid — the architecture already had the socket; F
   feeds it. Returns `null` (no envelope, score on polars alone as before) when
   there are fewer than `minPoints` points to trust a span from.

   Noise robustness (the priority input is logged instrument scatter):
   - a **TWS-region window** (`twsTolerance`) so a sail whose band shifts with
     wind speed isn't scored against the wrong region, falling back to the full
     point set when the local window is too sparse;
   - **trimmed quantiles** instead of raw min/max (`trimFraction`) so a single
     mis-logged point can't balloon the envelope;
   - an outward **`marginDeg`** so discretisation and edge noise don't clip a
     legitimately-sailed edge angle (aligned with D3's one-grid-step tolerance).

2. **Suppress trust outside the envelope** — feeding `limitScore` alone is *not
   enough*: the blend weights it by `(1−w)`, and R2.3's whole point is that
   out-of-band extrapolations score `w ≈ 1`, zeroing the limit term. So for an
   implicit envelope, `evaluateSail` damps the polar confidence toward the limit
   fallback: `confidence = rawConfidence × clamp01(limitScore)`. The trapezoid
   **is** the trust curve — `clamp01(limitScore)` is 1.0 across the observed
   band and 0 outside it — so the (now-negative) limit fallback drives the
   ranking at angles the sail never sailed, and the sail also drops out of the
   normalisation pool there (a free R2.2 fix: it can no longer deflate everyone
   else's `polarScore`). This is the literal reading of the review's "out-of-
   range decay *instead of a trusted extrapolated speed*."

Config lives in `suggestionConfig.ts` under `coverageEnvelope`
(`minPoints: 4`, `twsTolerance: 6`, `trimFraction: 0.05`, `marginDeg: 5`).

## Scope boundary (why `hasLimits` stays "explicit")

- **Explicit limits are left completely unchanged.** They keep precedence (an
  implicit envelope is only derived when no explicit limits exist), and they do
  **not** get trust suppression — F's mandate is implicit envelopes only, and
  H owns confidence/window recalibration. `SailEvaluation.hasLimits` therefore
  still means *explicit user limits*; the breakdown UI infers an implicit
  envelope from `limitScore != null && !hasLimits` and labels it "Outside
  observed range" vs. "Outside TWA limits".
- **Guards are unaffected.** `symmetryGuard`'s `skipWhenLimitsDefined` keys off
  explicit limits, not the implicit envelope — inferred data is not the user's
  declared intent.

## Results (Package E harness, default config)

| Fixture      | Wrong leader (pre-F → F) | Notes                                   |
| ------------ | ------------------------ | --------------------------------------- |
| `noisy-log`  | 52.2 % → **2.2 %**       | clears the < 25 % gate with room        |
| `clean-grid` | 31.1 % → **0 %**         |                                         |
| `upwind`     | 44.2 % → **3.3 %**       | jib zone included                       |
| `with-limits`| 54.4 % → 25.6 %          | residual = explicitly-limited sails (below) |

`with-limits` lags because its remaining failures are the **explicitly-limited**
sails (A2, A6) still extrapolating past their user limits and winning at high
confidence — the same `(1−w)≈0` weighting, which F does not touch on the
explicit path. **Extending the trust-suppression to explicit limits is the
highest-value follow-up** (a natural Package H sub-item): the mechanism is
identical, and it would make user-entered limits actually enforced. It is kept
out of F to honour the round-2 "one score-space move per package" discipline so
the harness can attribute each movement.

## Gates (all green)

- `noisy-log` leader accuracy materially better, wrong-leader < 25 % — **met**
  (2.2 %).
- `with-limits` shows explicit limits still winning over implicit ones —
  **met** (A2 uses its own `[140,165]`; never overridden by an implicit band).
- Round-1 scenario table stays green — **met** (all 12 scenarios unaffected:
  every no-explicit-limit scenario keeps its target inside the grid, so the
  trust factor is 1.0 and behaviour is unchanged).
- Ratchet re-locked to F's numbers in `accuracy.eval.ts` so G/H cannot regress
  the win.

## Files

- `features/sailSuggestion/util/coverageEnvelope.ts` — envelope derivation (new).
- `features/sailSuggestion/util/evaluateSail.ts` — explicit-vs-implicit limit
  selection + trust suppression.
- `features/sailSuggestion/model/suggestionConfig.ts` — `coverageEnvelope` block.
- `features/sailSuggestion/components/SailEvaluationCard.tsx` — honest label for
  the implicit case.
- Tests: `util/__tests__/coverageEnvelope.test.ts` (new),
  `util/__tests__/evaluateSail.test.ts` (envelope cases),
  `eval/accuracy.eval.ts` (baselines re-locked).
