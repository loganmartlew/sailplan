# Define verification criteria for uncertain-wind guidance

Type: grilling
Status: resolved
Blocked by: 04

## Question

What tests and evaluation criteria are sufficient to accept the range geometry,
tack and wind-zone behavior, material-alternate policy, low-confidence cases,
and route/state behavior as implementation-ready and trustworthy for sailors?

## Answer

Acceptance rests on **four layers**, each carrying a distinct class of risk.
This ticket fixes the *obligations* — what must be proven, at which layer,
against which oracle, and where each check runs. Case-by-case enumeration is
written with the final specification, not here.

The repo has **no CI and no git hooks**: every check is human-invoked. So
"enforced" means either *in the default `npx jest` run* or *on a written
checklist someone follows before merge*. Nothing else is enforcement.

### Layer 1 — Pure unit tests (default `npx jest` run)

**Geometry, against a brute-force oracle.** `getTwaRange` is verified by
comparison against a deliberately naive second implementation: step the TWD arc
in `1°` increments, fold each sample to TWA, keep the min and max. Compare
across **every** integer bearing (`0–359`), a full set of central TWDs, and
every spread (`0–40`). The whole sweep is a few hundred thousand cheap
comparisons and runs in a second or two.

The oracle is the point. The failure mode this feature is most exposed to is
computing the interval from the arc's two **endpoints**, which is correct except
when the arc straddles `0°` or `180°` — precisely where issue 02's fold puts the
extreme value in the *middle* of the arc, not at an end. That produces a
plausible wrong number rather than a crash. Exhaustive comparison cannot miss
it, where hand-picked examples and randomised property generation both can.

The same sweep incidentally proves `sampleTwdRange` and `getTwaRange` agree —
nothing else checks that.

Rejected: a property-based testing library. It adds a dependency, and random
sampling is strictly weaker than checking every input when the input space is
this small.

**Alternate policy.** Tested directly against issue 01's rules, in two forms
(see *Constants* below):

- **Shape tests, parametrized over config** — contiguity of qualifying
  intervals, the `max(5°, 20% of 2s)` persistence floor, one-alternate-per-side,
  the side tie-break order (limit before speed, then wider interval, then larger
  advantage, then central rank), the refusal to join adjacent limit-based and
  speed-based intervals, and the "no finite central leader ⇒ no alternates"
  case. These run at several config values, so tuning the thresholds does not
  break them.
- **Golden cases at `DEFAULT_SUGGESTION_CONFIG`** — a small pinned set, so that
  a change to the shipped thresholds fails loudly and on purpose.

**Low-confidence and missing data.** Explicit cases proving the speed trigger
cannot fire without moderate-confidence evidence on *both* sides, and that
missing limits read as *unknown* rather than *inside*.

**Display agreement.** The rule that the tack badge disappears whenever the
angle *renders* as `0°` or `180°` — so a central TWA of `0.4°` loses its badge —
lives in a **pure helper** beside the existing formatters, called by the
components, and is unit-tested at the rounding boundaries. It is a
rounding-boundary rule, the category that breaks silently, and there are no
render tests to catch it.

**Cache contract.** Two tests pin ticket 04's two claims:

1. A ten-leg course at `±40°` performs **at most `181 × sails`** underlying
   evaluations. Asserted as a *bound*, not a count, so a future optimisation
   doing fewer evaluations still passes.
2. A fresh `SailSuggestionData` identity yields fresh evaluations.

Together these are the only thing keeping the shared module-level `WeakMap`
honest. A plausible refactor — a per-hook memo, or a cache keyed on something
identity-unstable — silently multiplies a ten-leg course's work by ten with no
visible symptom on a fast device. Invocation counting is deterministic and
device-independent; a wall-clock budget was rejected as flaky.

**Reduced spread-0 parity.** One fixture, one condition slice, asserting the
range path at `twdSpread: 0` matches the scalar path exactly — see Layer 2.

### Layer 2 — Accuracy sweep (`npm run eval:suggestions`)

**No new fixtures, no new ratchet baseline for alternates.** The existing sweep
works because its fixtures carry ground truth that exists independently of our
code: the dataset was generated from "the J1 is genuinely fastest at 45°/12kn",
so measuring the engine against it tests whether the engine is any good.

Alternate sails have no such independent truth. Whether a Code 0 winning across
`7°` of a `40°` range *deserves* to be shown is not a fact about the world — it
is issue 01's decision. Building fixtures for it would mean recording our own
rule as the "truth" and checking the code matches the rule. That is a unit test
wearing an expensive costume, and it is already covered by Layer 1.

**One addition instead: spread-0 parity.** Route the existing sweep through
`suggestSailsAcrossRange` at `twdSpread: 0` and assert the four locked
per-fixture scores in `features/sailSuggestion/eval/accuracy.eval.ts:50` come
out **unchanged**. This is the direct test of ticket 04's central claim —
that uncertainty-off is the same code path, not a branch. Any `if (enabled)`
that quietly alters behaviour moves those numbers.

The full comparison stays opt-in (too slow for the default run) and goes on the
acceptance checklist; the reduced version above runs by default, so the
"did we accidentally branch" question is answered on every `npx jest`.

### Layer 3 — Manual scenario script (on device)

There are no component or e2e tests, so every claim about what a sailor
actually sees is verified by running the app. Ten named scenarios, each
existing because it can fail in a way the pure tests cannot see, and each
mapping onto a decision from issues 01–03:

1. **Uncertainty off** — every surface identical to today.
2. **Fold at head-to-wind** — beat whose arc crosses `0°`; interval starts at
   `0°`, tack badge gone.
3. **Fold at dead downwind** — run whose arc crosses `180°`; interval ends at
   `180°`.
4. **Limit trigger** — central sail crosses its own minimum TWA at one end;
   one limit-triggered alternate.
5. **Speed trigger, one side** — other side reads *No change from the expected
   sail*.
6. **Two different alternates** — the full `← [x] ⛵[y] [z] →` badge row.
7. **Same sail both sides** — appears once, carrying both qualifying regions.
8. **Compass wrap** — arc crossing `0°/360°`; the band splits into two fills and
   does **not** read as a fold or a break.
9. **Sub-floor spread** — `±2°`, each side under the `5°` floor, so no
   alternates and the card must not grow.
10. **Missing / low-confidence polars** — no speed-triggered alternate is
    manufactured.

This script is **checked in under `sailplan-app/docs/`** as a standing manual
regression script, with the specification pointing at it. It is re-run whenever
this area changes, not once at merge — and `docs/testing.md` currently says UI
is verified by running the app without saying what to look at, so this gives
that sentence something to point to.

On-water validation is valuable but cannot gate a merge, so it is not an
acceptance criterion.

### Layer 4 — Things verified structurally, with no test at all

Issue 02's **prohibitions** — no possible-tack set, no tack-change flag, no
zone-crossing list — are enforced by `RangeSailSuggestionResult` simply not
having those fields. An unrepresentable state needs no test, and a test
asserting a field's absence is noise.

What this *does* require is a **comment on the type recording that the omission
is deliberate**. That comment is the real artifact: it is what stops a future
contributor from "completing" the type.

### Constants

Issue 01's tuning numbers move into a new `alternates` block on
`SuggestionConfig` (`features/sailSuggestion/model/suggestionConfig.ts:11`):

```ts
alternates: {
  speedAdvantage: 0.10,     // fraction
  minIntervalDeg: 5,
  minIntervalFraction: 0.2, // of the full 2s range width
}
```

That file already declares itself the single source of truth for every tuning
constant and is threaded explicitly through the pipeline; the moderate-
confidence gate issue 01 relies on already reads `confidenceTiers.moderate`
from it. Housing the alternate constants there is what makes the parametrized
shape tests free — they pass a modified config, exactly as the existing
suggestion tests do.

### Invalid navigation payload

Ticket 04 widens `courseLegDataSchema` with `twd` and `twdSpread`. A route param
serialized by an older build therefore fails to parse — and
`deserializeCourseLegData` uses `.parse()`, called uncaught at
`app/(plan)/course/leg.tsx:47`, so today that **throws and breaks the screen**.

The two new fields are made **tolerant**: missing or invalid values default to
`twdSpread: 0`, i.e. uncertainty off. One test covers it. The screen then
degrades to today's exact UI rather than crashing, which is also the honest
failure mode — a lost spread means *less* information, never *wrong*
information.

The general crash-on-bad-param behaviour for the pre-existing fields is a real
problem but is **not** fixed here; it is its own effort.

### The acceptance bar

The feature is implementation-ready and trustworthy when:

- `npx jest` is green, including the geometry oracle sweep, the alternate shape
  and golden tests, the display-agreement helper, both cache-contract tests,
  and the reduced spread-0 parity check;
- `npm run eval:suggestions` is green with the four locked baselines
  **unchanged** under the full spread-0 parity comparison;
- all ten manual scenarios have been walked on a device and signed off.
