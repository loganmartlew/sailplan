# 02 — Duplicate polar points silently zero out interpolation confidence

Status: resolved

## The gap

`buildPolarGrid` groups points by exact TWS and sorts each column by TWA, but
nothing prevents two rows landing on the same (TWS, TWA) node. Nothing on the
write side prevents it either: `sailPolar` is `(id, tws, twa, speed, sailId)`
with **no unique constraint** (`schema.ts:53`), CSV import bulk-inserts every
parsed row (`features/sailPolar/util/sharing.ts:68`), and manual add inserts
unconditionally (`SailPolars.tsx:56`). Nothing dedupes, upserts, or warns.

Three distinct defects follow, measured on the shipped engine with a clean 2×4
lattice (TWS 8/10 × TWA 60–120) queried at TWS 9 / TWA 90:

| case | speed | confidence |
| --- | --- | --- |
| clean lattice | 6.700 | **1.000** |
| one row duplicated identically | 6.700 | 1.000 |
| one row tripled identically | 6.700 | 1.000 |
| **every row duplicated identically** | 6.700 | **0.000** |
| every row duplicated 1.0 kn higher | 7.200 | **0.000** |

**(a) Order-dependent speed.** `bracketAxis` binary-searches the TWA axis and
returns the first index it lands on; the other duplicate is never consulted.
Three rows at one node (6.5 / 7.4 / 8.0) return 6.500 — not the mean, median,
or max, just whatever SQLite handed back first.

**(b) Bilinear corners taken from different duplicate sets.** `bracketAxis`
returns the first index ≥ target, so `hiIndex` lands on the **first** duplicate
of the upper value while `loIndex = lo - 1` lands on the **last** duplicate of
the lower value. In the "duplicated 1.0 kn higher" case the corners used were
`7.4 @80 / 6.6 @100 / 7.8 @80 / 7.0 @100` — high row at TWA 80, low row at TWA
100. The returned surface belongs to neither stored table.

**(c) Confidence collapses to exactly zero — the severe one.** Duplicates
inject zero-width gaps into the TWA axis. Once half or more of a column's
adjacent gaps are zero, `medianAxisGap` returns 0 and
`twaGapFactor = min(1, 0 / gap) = 0` zeroes the entire confidence product. Note
from the table that this fires on **byte-identical rows carrying zero
conflicting information**, while the predicted speed stays *correct*.

`interpolateSpeed` on the **IDW** path has a smaller version of the same
defect: a point within `EPSILON` of the query returns `point.speed` and stops,
never consulting its twin.

## Impact

**Functional, not cosmetic.** `suggestionConfig.ts:94` sets
`blend.lowConfidence: 0.25` — "confidence at/below which ranking is pure limits
(w = 0)". Confidence 0 means the suggestion pipeline **ignores the polar table
entirely** and ranks on TWA limits alone.

The realistic trigger is mundane: **importing the same CSV twice** ("did that
import work? let me try again"). Every row duplicates, every column's median
gap becomes 0, and every sail in that file silently loses polar-based
suggestion — while the polar screen still lists all the rows and the predicted
speeds still look right. Nothing tells the user, and the only bulk remedy is
"delete all polars for this sail".

Reachable today with no NMEA code involved.

## The fix

Decided in
[nmea-ingestion 15](../../nmea-ingestion/issues/15-duplicate-point-collision.md);
see its answer for the full reasoning. Summary:

1. **Grid-builder invariant: a `PolarGrid` never holds two rows at the same
   (TWS, TWA) node.** Stated structurally rather than as a tie-break patch, it
   sits upstream of all three defects — bracketing cannot pick the wrong row,
   corners cannot be mismatched, and zero-width gaps become impossible so
   `medianAxisGap` cannot be poisoned. It also makes `buildPolarGrid` match
   what `buildClusteredPolarGrid` already guarantees.
2. **Collision means exact equality, never a tolerance.** Tolerance-based
   merging is `buildClusteredPolarGrid`'s job (1 kn TWS, 4° TWA); doing it in
   two places at two widths produces results nobody can explain. The exact path
   exists to reproduce hand-entered tables faithfully.
3. **Median collapses conflicting speeds**, matching the clustered path. This
   is deliberately *not* a second run at the target-vs-average question — that
   applies at promotion, and a high statistic here would apply optimism twice.
4. **The collapsed row carries its contributing count `n`**, from **both**
   builders (duplicate count for `buildPolarGrid`, the bin population
   `buildClusteredPolarGrid` already computes and discards). One row type, so
   confidence cannot mean different things depending on which engine served the
   query. `n` is **carried but not yet consumed** — see below.
5. **Fix the IDW `EPSILON` shortcut** alongside, as a separate one-liner.

Existing duplicate rows already in users' databases **self-heal** at the next
query — the rule is read-side, so no migration and nothing destroyed on the
write side.

## Do not

**Do not let `n` raise confidence.** It was considered and deliberately
rejected: on the clustered path `n` is bin population and bimodal by provenance
(hundreds of samples per bin for a capture, one for an import), so "`n` raises
confidence" decodes to "captured data beats imported data" — which is
[nmea-ingestion 16](../../nmea-ingestion/issues/16-blend-weight-and-coverage.md)'s
open question, and a *second* implicit knob duplicating the blend weight. There
is also no headroom: bilinear confidence is already exactly 1.0 on a clean
lattice, so density could only climb by demoting every existing user's table.

**Do not change the interpolation cascade.** Same three engines, same order,
same fallbacks. Only the grid builders' output contract changes.

**Do not change `pointsUsed` display.** `SailEvaluationCard.tsx:176` renders
`pointsUsed.length` as "N polar points"; after collapsing these are nodes, not
stored rows. The clustered path already returns synthetic rows today, so this
is not new. Surfacing `n` waits on `16`.

## Tests

Cover the four rows of the table above — in particular that byte-identical
duplication leaves confidence at 1.0, and that reversing row order does not
change the result.

## Provenance

Surfaced while resolving
[nmea-ingestion 03](../../nmea-ingestion/issues/03-mixed-provenance-interpolation.md),
ticketed and decided as
[nmea-ingestion 15](../../nmea-ingestion/issues/15-duplicate-point-collision.md).
That map produces decisions rather than code, and this is a shipped bug that
should not wait on the spec being finished — so the implementation is logged
here. Prevention at the write side (warn on re-importing an identical CSV) is a
separate question, owned by
[nmea-ingestion 18](../../nmea-ingestion/issues/18-duplicate-import-prevention.md).

## Comments

**Implemented** on branch `nmea-ingestion`. `PolarGrid` now holds
`PolarGridRow` (`PolarPoint` + `n`), and both builders enforce the one-row-per-
node invariant: `buildPolarGrid` groups TWS → TWA and collapses each node by
median with `n` = duplicate count; `binColumnByTwa` now emits the bin
population it was discarding. `interpolateSpeed`'s IDW `EPSILON` shortcut
medians all coincident points instead of returning the first, and reports them
as the one collapsed node so the "N polar points" display keeps counting nodes.
`InterpolationResult.pointsUsed` stays `PolarPoint[]` — `n` rides on the grid
rows, unspent.

Known live tension, left for `16`: IDW's `pointCountScore` counts stored rows in
the window, not nodes, so duplicates still nudge *IDW* confidence up. Out of
scope here (the invariant is on the grid builders) but it is the other half of
D6.

Tests cover all four rows of the table above (byte-identical duplication holds
confidence at 1.0; conflicting duplicates give the median surface at
confidence 1.0), plus row-order invariance on the builder, the engine, and the
IDW twin path. Full suite green (190 tests); the one pre-existing assertion
that changed is `pointsUsed` gaining `n: 1`. Feature README documents the
invariant.
