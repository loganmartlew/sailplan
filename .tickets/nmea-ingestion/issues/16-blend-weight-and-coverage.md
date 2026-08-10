# 16 — What measured-weight and coverage radius should the blend use?

Type: prototype
Status: open
Blocked by: 21
Map: [map.md](../map.md)

## Question

[03](03-mixed-provenance-interpolation.md) decided that imported and captured
polars are **never pooled**: each source is interpolated on its own grid and
the two answers are blended at an explicit weight, with measured contributing
only where it has coverage near the query. Two numbers were deliberately left
open, because the fixture cannot supply them.

**1. The measured weight `w`.** In `03`'s harness the imported table *is*
ground truth by construction, so w=0 wins by definition and the sweep only
shows that error scales linearly and predictably with `w`:

| w | in raced band | outside |
| --- | --- | --- |
| 0 | 0.01 % | 0.01 % |
| 0.5 | 1.22 % | 0.25 % |
| 1.0 | 2.44 % | 0.50 % |

On the water the bet runs the other way — inside a band you actually sailed,
the measurement is plausibly better than a manufacturer or hand-entered table.
The messy-import case is the only hint the fixture offers in that direction
(3.25 % at w=0 improving to 2.34 % at w=0.75).

Sub-questions: is `w` a single global constant, a per-sail preference, or
derived from something — sample count, the existing `confidence` score, how
stale the import is?

**2. The coverage radius.** `03` used "measured contributes where it has a
point within 1 kn of the query TWS". That produced a soft edge: queries just
outside the raced band picked up 0.13–0.50 % error from race points bleeding
across the boundary. A soft edge is probably right — a hard cliff at the band
edge would be worse — but its width is a choice, and TWA coverage was not
modelled at all (only TWS).

**Blocked by [`21`](21-race-day-capture.md)** — this needs a real capture with
real instrument noise against a real imported table for the same boat, so that
"which source is closer to the truth" is an observation rather than an
assumption. Per the map's boat-access constraint, nothing else waits on this.

The dependency moved from `04` to `21` when `04` was re-cut into a dockside
visit and a race-day capture. Dockside data cannot serve this ticket at all:
with the boat tied up there is no boat speed, so there are no polar points to
weigh. It needs sailing, and it needs the race data to have been through the
`07` → `10` pipeline into actual captured points — not just raw sentences.

**Two read paths, not one.** Build ticket `10` landed
`CAPTURE_COVERAGE_RADIUS` in
`sailplan-app/features/sailPolar/util/sourceAwareInterpolation.ts`, and it is
read in two places: the blend weight itself, and `evaluateSail`'s coverage
envelope, which admits a captured point to TWA-limit scoring only within the
same radius. Whatever this ticket decides moves both — check the envelope
behaviour, not just the blended speed.

Reuse `sailplan-app/features/sailPolar/eval/mixed-provenance.prototype.ts` on
branch `prototype/03-mixed-provenance` — the blend sweep is already built
(`evaluateBlended`); it needs real data substituted for the fixtures.

## Answer

<!-- filled on resolution -->
