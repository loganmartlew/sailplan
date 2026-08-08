# 03 — Does captured data poison a sail's existing polar grid?

Type: prototype
Status: resolved
Blocked by: —
Map: [map.md](../map.md)

## Question

Founding decision 5 puts captured points into `sailPolar` alongside imported
ones. Does that actually work, or does mixing a clean grid with hundreds of
noisy measured points make interpolation *worse* for that sail?

The concern is concrete. `buildPolarGrid` groups by **exact** TWS, so:

- A clean imported grid forms proper multi-row columns.
- Measured points each get a near-unique TWS, so each becomes its own
  single-point column.
- Mixed together, the exact grid is a clean lattice interleaved with hundreds
  of one-point columns. Bilinear may now "bracket" a target between two noisy
  single-point columns and return something worse than it would have from the
  clean grid alone — or fail, fall through to `buildClusteredPolarGrid`, and
  cluster the clean lattice points together with the noise at 1 kn tolerance,
  dissolving the very structure that made the clean data good.

This is testable **today**, without any NMEA code:

- `polars/fixtures/` already ships a `noisy-log` variant (logged-style data)
  and `clean-grid` (lattice data) with ground-truth manifests.
- `npm run eval:suggestions` in `sailplan-app/` is an existing accuracy sweep.
- `features/sailPolar/util/interpolation.ts` +
  [`README.md`](../../../sailplan-app/features/sailPolar/README.md) document
  the bilinear → clustered → IDW cascade and its config knobs.

Build a throwaway harness that measures interpolation error against ground
truth for three cases per sail — **clean only**, **captured only**, and
**clean + captured mixed** — and answer:

1. Does mixing measurably hurt, help, or do nothing?
2. If it hurts, which mechanism is responsible — spurious bracketing on the
   exact grid, or clustering dissolving the clean lattice?
3. What's the remedy? Candidates: keep sources in separate grids and prefer
   one; let the provenance column *segregate* rather than merely annotate;
   tune `twsClusterTolerance`; snap captured points onto the existing grid's
   TWS columns at promotion time rather than storing raw values.

The answer feeds the **merge vs. replace** fog on the map, and may change what
the provenance column is *for* — annotation versus separation.

## Answer

**The ticket's premise is mostly wrong, but it uncovered a real design gap and
a shipped bug.** Captured data does not poison a sail's polars in general. The
damage the ticket feared needs two conditions at once — a *lattice-shaped*
import, and a query inside the TWS range the capture covered — and even then
what happens is better described as an **uncontrolled takeover** than as
poisoning.

Measured with a throwaway harness on `polars/fixtures/`, treating `clean-grid`
as the import and `noisy-log` as a capture session of the same fleet. Both come
from the same ground-truth speed curves, so the manifest's `baseSpeeds` is the
truth. 264 queries per case, all deliberately *off* the clean lattice.
Prototype and full output:
**branch `prototype/03-mixed-provenance`**,
`sailplan-app/features/sailPolar/eval/mixed-provenance.prototype.ts` and
`duplicate-speeds.prototype.ts` (run with `npx tsx`).

### 1. Does mixing hurt, help, or do nothing?

It depends entirely on the shape of what's already there, and on coverage.

| scenario | import alone | + captured | verdict |
| --- | --- | --- | --- |
| dense lattice import, capture spanning the same full range | 0.01 % | 1.32 % | hurts a lot — but this is a fixture artifact, not a race |
| **full-range lattice import + one race in 10–14 kn**, queries **inside** that band | 0.01 % | **1.10 %** | hurts locally |
| same, queries **outside** the raced band | 0.01 % | **0.01 %** | **no effect at all** |
| **messy (logged) import** + one race, inside band | 3.25 % | **2.26 %** | **helps** |
| captured-only, 1 → 2 → 3 sessions pooled | 3.33 % → 2.58 % → **2.09 %** | | **pooling sessions is strictly good** |

Two corrections to the ticket's framing fall out:

- **A race cannot invalidate the rest of the table.** Outside the raced TWS
  band the error is unchanged to four decimals and the exact grid still serves
  every query, because the bracketing columns there are still the import's own
  multi-row columns. The alarming headline number came from a capture that
  happened to span 4–26 kn, which no single race does.
- **The "clean lattice" is a fixture artifact.** A CSV exported from a
  chartplotter is logged scatter, and mixing a race into *that* improves it.
  The pathology needs a hand-entered-table shape to destroy.

### 2. Which mechanism?

Neither of the two the ticket proposed, quite. Bilinear never returns a *bad*
bracket from the noisy single-point columns — it returns `null`, because a
one-row column cannot interpolate in TWA. That failure cascades the whole sail
onto `buildClusteredPolarGrid`, and there the second feared mechanism does
happen, with a sharper edge than expected:

**a race in 10–14 kn collapses that entire range into a single column.**
Clustering starts a new column only when the TWS gap exceeds
`twsClusterTolerance` (1 kn). Import columns at 4, 6, 8… have 2 kn gaps and
survive. But race points fill 10–14 kn with sub-knot spacing, so there is no
gap anywhere in it, and the import's 10, 12 and 14 kn columns are swallowed
into one column at the mean TWS (~12) with 4°-binned median rows. Three columns
become one — the loss is *resolution*, not just fidelity.

So the "band" in which captured data takes over is **whatever contiguous run of
TWS has no >1 kn gap in it**. Nothing declares it, nothing displays it, and it
moves depending on how the breeze varied during the race.

### 3. The remedy — blend, never pool

Candidates from the ticket were measured and rejected: snapping captured TWS
onto the import's columns is *worse* than raw pooling (2.97 % vs 1.32 %) — it
restores the exact path but packs hundreds of noisy rows into each column; and
condensing to one median row per node still leaves the import's structure gone
(1.17 % dense, and a much worse 5.20 % against a sparse import).

What works is **interpolating each source on its own grid and blending the two
answers at an explicit weight** — `estimateSailSpeed` called once per source,
with *no changes to the interpolation engine*. Same one-race setup:

| measured weight | in race band | outside | import grid |
| --- | --- | --- | --- |
| w = 0 (import only) | 0.01 % | 0.01 % | exact 48/48 |
| w = 0.25 | 0.61 % | 0.13 % | exact 48/48 |
| w = 0.50 | 1.22 % | 0.25 % | exact 48/48 |
| w = 0.75 | 1.83 % | 0.37 % | exact 48/48 |
| w = 1.0 (measured only) | 2.44 % | 0.50 % | exact 48/48 |
| *pooled, for reference* | *1.10 %* | *0.01 %* | *clustered 43/48* |

The decisive finding is in the last row. **Pooling is already a blend — just an
uncontrolled one.** Its 1.10 % sits between w=0.25 and w=0.50, so pooling
behaves like a measured-weight of roughly 0.45 that nobody chose: it is the
emergent result of how many points the race produced and where the clustering
fell. Race twice as long and the implicit weight moves. Blending produces the
same class of answer with the weight chosen deliberately, error scaling
linearly and predictably with it, and the import's columns intact at every
weight (exact grid 48/48 throughout).

It also **replaces the undeclared band with an explicit rule**: measured
contributes where it has coverage near the query, imported answers alone
elsewhere.

**Decision (Logan, this session):**

1. **The spec forbids pooling sources into one point set.** Interpolate per
   source; blend with an explicit measured-weight and an explicit coverage
   rule.
2. **Provenance therefore has to *separate*, not merely annotate.** Founding
   decision 5's source column is load-bearing for building the per-source grid,
   not just for reversibility. This is the one part of founding decision 5 that
   changes.
3. **The rule applies only at the imported/captured boundary.** Capture
   sessions still pool with each other — the measurement backs it (3.33 % →
   2.58 % → 2.09 % as sessions accumulate).
4. **The weight's value and the coverage radius are deferred to `16`** — this
   fixture makes the import ground truth by construction, so w=0 wins by
   definition here and the fixture cannot answer it. Needs real captured data
   from `04`.

Caveat carried forward: with a ±1 kn coverage rule, the region outside the
raced band is no longer *exactly* untouched (0.13–0.50 % at w>0), because race
points at 14 kn bleed into a query at 15 kn. A soft edge at the coverage
boundary is probably right, but its width is a choice — `16` owns it.

### 4. Bonus finding — a shipped bug in duplicate handling

Probing what happens when two points share TWS/TWA but disagree on speed
(`duplicate-speeds.prototype.ts`) turned up an **order-dependent answer on the
exact-TWS grid path**:

```
two rows at tws=10, twa=100, 1.5 kn apart
  duplicate appended  (6.5 then 8.0)  → 6.500
  duplicate prepended (8.0 then 6.5)  → 8.000
```

`bracketAxis` binary-searches the TWA axis and returns the first index it lands
on; the other duplicate is never consulted. Three samples at one node
(6.5 / 7.4 / 8.0) return 6.500 — not the mean (7.30), not the median (7.40),
not the max (8.00), just whichever row came back first from SQLite. **This is
reachable today by importing a CSV with duplicate rows** and has nothing to do
with NMEA. Ticketed as `15`.

The clustered path is well-behaved by contrast — deterministic median (7.400),
and robust in the right way: one optimistic 11 kn flyer among three moves it
7.40 → 7.70, while four flyers out of seven correctly take it to 11.00. IDW is
the fragile one: a single flyer near the query pulls it to 10.27.

On **avg vs. max**, raised while resolving this: these are two questions. The
*promotion-time* statistic is `07`'s, and now has a real table to choose from
(`14` measured p90 at +3.1 % and p75 nearly unbiased at +0.9 % once trim is
autocorrelated; mean/p50 run negative) — `07` sharpened accordingly. The
*interpolation-time* collision rule is a different thing and should stay
neutral: if promotion has already applied "target" optimism, re-aggregating
with a max at query time would apply it twice. That framing is recorded on
`15`.
