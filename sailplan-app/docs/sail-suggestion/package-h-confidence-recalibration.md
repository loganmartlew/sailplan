# Package H — Confidence & window recalibration

> Final round-2 package from [`accuracy-review.md`](./accuracy-review.md): the
> fix for finding **R2.3** ("confidence doesn't punish extrapolation enough for
> the blend to matter") plus the explicit-limit enforcement that **F** and **G**
> deferred. Trust-suppression now enforces **explicit user limits** — a fast
> sail can no longer win at an angle the user marked off-limits by extrapolating
> its polar past the window. Judged by Package E's harness — `with-limits`
> wrong-leader **15.6 % → 2.2 %** and expected-absent **6.7 % → 0 %**, reaching
> parity with `noisy-log`; every other fixture holds.

## The problem it fixes

After F+G, one failure class survived: **explicitly-limited sails
extrapolating past their own user limits and winning at high confidence**. On
`with-limits`, A2 (user limit `[140,165]°`) led at TWA 175–180° and A6
(`[95,120]°`) at 120–130° — outside their declared windows. The mechanism was
exactly R2.3: a one-sided extrapolation past a band still scores IDW confidence
0.6–0.85, which the blend treats as `w ≈ 1` (full polar weight), so the
`(1−w)·limitScore` term — negative there — is weighted to nothing and the fast
polar carries the ranking.

Package F fixed this for **implicit** envelopes by damping the polar confidence
toward the limit fallback outside the observed band (`confidence =
rawConfidence × clamp01(limitScore)`), but it deliberately left **explicit**
limits untouched to keep that score-space move measurable on its own (round-2
"one move per package" discipline). H closes the gap.

## What it does

Two changes, no new files.

1. **Enforce explicit limits via trust-suppression** — `util/evaluateSail.ts`.
   The suppression now covers explicit user limits as well as implicit
   envelopes, but the two earn **different curves**, because their edges mean
   different things:

   - **Implicit envelope (F, unchanged)** — inferred from noisy polar coverage,
     so its edge is *fuzzy*. Damped **smoothly** by `clamp01(limitScore)`: the
     trapezoid taper is the graded trust as the target leaves observed data.
   - **Explicit user limit (H, new)** — a crisp, deliberate statement. Inside
     the window the user vouches for the sail **in full**; outside it's a hard
     cutoff. So: **full trust in-window, zero outside** — no taper damping.

   Both zero out beyond the edge, dropping the sail from the `maxSpeed`
   normalisation pool and letting the now-negative limit fallback drive its
   rank. A2 at 175° is outside `[140,165]°` → confidence 0 → it ranks by its
   (negative) limit score, and the correct S1 wins.

2. **Rebalance the IDW confidence weights (R2.3)** —
   `sailPolar/model/interpolation.ts`. `confidenceWeights` moves
   `0.5/0.3/0.2 → 0.4/0.2/0.4` (distance / pointCount / **coverage**). Coverage
   is the only term that knows whether the target is *bracketed* rather than
   extrapolated, so it's promoted to equal-highest; pointCount — which a dense
   band maxes out regardless of *where* the target sits — is demoted as the
   least trustworthy signal of extrapolation.

## Why the explicit path is crisp, not smooth (the S10 lesson)

The first cut applied F's smooth `clamp01(limitScore)` to explicit limits too.
It fixed `with-limits` but broke round-1 scenario **S10**: a sail the user
marked good up to 175°, evaluated at 172° (well inside), had its trust damped to
0.65 because 172° lands in the *taper* of the one-sided limit's synthetic
window — so an identical-polar unlimited rival edged it out. That's wrong: the
user vouched for the sail there. A user window is a yes/no statement, not a
graded preference, so H keeps **full trust anywhere inside it** and only cuts at
the edge. The unit tests pin this: differing `limitScore` across a window's
plateau vs. taper, but *identical* (full) confidence inside it.

Symmetrically, dropping F's *smooth* taper for the **implicit** path was tried
and rejected — it regressed `clean-grid` strict wrong-leader 0 → 24 and nudged
`noisy-log`/`upwind` up by one. The fuzzy data edge genuinely wants the graded
taper; the crisp user edge does not. Hence the split.

## Why `maxTwaDelta` was left at 40° (the review's other R2.3 knob)

R2.3 also proposed tightening `maxTwaDelta` (40° → ~15–20°). Swept against the
harness, it was **rejected**: `maxTwaDelta` is shared with the bilinear clamp in
`sampleColumn`, so tightening it collapses `bilinearServed` (455 → 324 at 20°,
→ 285 at 15°) — regressing Package G's floor — while giving **zero** leader-
accuracy gain on any fixture. The extrapolation problem it was meant to curb is
already solved upstream by the envelope/limit trust-suppression, which cuts
trust at the *usable band* rather than at a blunt fixed radius. `twaScale` and
the blend thresholds were likewise re-checked and left unchanged; selection is
never the weak spot (expected-absent is 0 on every fixture), so
`selection.margin` was not retuned.

## A note on the coverage rebalance

The weight change is a **no-op on all four fixtures** (WL/EA/bilinear identical
before and after): the dense-band fixtures always assert an envelope, so the
trust-suppression already zeroes out-of-band confidence at the *source*, ahead
of the IDW coverage term. Its effect is on the paths the fixtures don't
exercise — genuinely scattered imports and sails below `minPoints`, where no
envelope is derivable and IDW confidence stands alone. There, promoting the
bracketing signal makes a one-sided extrapolation score lower, as R2.3 intends.
It's shipped because it's the model-honest direction and provably non-regressing;
it's kept moderate (0.4, not 0.5/0.6 — all three were fixture-identical) to avoid
unvalidated aggressiveness.

## Results (Package E harness, default config)

| Fixture      | Wrong leader (G → H) | Expected absent (G → H) | Bilinear served |
| ------------ | -------------------- | ----------------------- | --------------- |
| `noisy-log`  | 2.2 % → 2.2 %        | 0 % → 0 %               | 84.3 % (held)   |
| `clean-grid` | 0 % → 0 %            | 0 % → 0 %               | 85.2 % (held)   |
| `with-limits`| **15.6 % → 2.2 %**   | **6.7 % → 0 %**         | 84.3 % (held)   |
| `upwind`     | 1.7 % → 1.7 %        | 0 % → 0 %               | 58.6 % (held)   |

`with-limits` now matches `noisy-log`: its two residual D3-adjusted failures are
the same benign crossovers `noisy-log` carries — A6/A5 at the 120° band edge and
A2/S1.5 at 155° @ 14 kn — near-ties, not extrapolation bugs.

## Gates (all green)

- D3-adjusted leader accuracy > 90 % on `noisy-log` (97.8 %) and `clean-grid`
  (100 %) — **met** (both were already met after F+G; H holds them).
- Harness scores improve or hold on all fixtures — **met** (`with-limits`
  improves sharply; the rest hold exactly).
- Explicit limits are enforced: no sail wins outside its user window — **met**
  (A2/A6 extrapolation wins gone).
- Round-1 scenario table stays green — **met** (166 → 169 tests; S10 preserved
  by the crisp-window rule, three H unit cases added).
- Ratchet re-locked to H's numbers in `accuracy.eval.ts`.

## Files

- `features/sailSuggestion/util/evaluateSail.ts` — split trust-suppression:
  smooth `clamp01` for implicit envelopes (F), crisp in/out for explicit limits.
- `features/sailPolar/model/interpolation.ts` — `confidenceWeights` rebalance
  (coverage 0.2 → 0.4, pointCount 0.3 → 0.2, distance 0.5 → 0.4).
- Tests: `util/__tests__/evaluateSail.test.ts` — explicit-limit suppression
  cases (outside → zero trust; in-window taper → full trust; explicit-vs-implicit
  taper contrast); moderate-tier fixture updated for the new coverage weight.
- `eval/accuracy.eval.ts` — `with-limits` baseline tightened (14 → 2 wrong
  leader, 6 → 0 expected absent).

## Not in scope

- **Import-time aggregation** (the D1 fallback design) — still unnecessary; the
  in-engine clustered grid (G) handles logged noise on these fixtures.
- **`maxTwaDelta` / `twaScale` retuning** — evaluated and rejected above; the
  window is left as G tuned it.
- A `sailType` column and per-zone threshold refinements remain the same
  optional future work flagged in round 1.
