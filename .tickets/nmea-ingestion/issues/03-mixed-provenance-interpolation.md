# 03 — Does captured data poison a sail's existing polar grid?

Type: prototype
Status: open
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

<!-- filled on resolution -->
