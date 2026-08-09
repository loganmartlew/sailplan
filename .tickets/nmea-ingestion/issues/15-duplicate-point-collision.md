# 15 — What should interpolation do when stored points collide?

Type: grilling
Status: resolved
Blocked by: —
Map: [map.md](../map.md)

## Question

Surfaced while resolving
[03](03-mixed-provenance-interpolation.md). Two polar points that share a TWS
and TWA but disagree on speed resolve **by row order** on the exact-TWS grid
path:

```
two rows at tws=10, twa=100, 1.5 kn apart
  duplicate appended  (6.5 then 8.0)  → 6.500
  duplicate prepended (8.0 then 6.5)  → 8.000
```

`bracketAxis` binary-searches the TWA axis, returns the first index it lands
on, and never consults the other row. Three samples at one node
(6.5 / 7.4 / 8.0) return 6.500 — not the mean, median, or max, just whatever
SQLite handed back first.

**This is a shipped bug, not an NMEA one.** It is reachable today by importing
a CSV containing duplicate rows; capture just makes it far more likely. The
clustered path is already correct here (deterministic median per 4° bin), so
the fix is confined to the exact-TWS path — or to the write side.

Decide:

1. **Where the collision is resolved** — dedupe at promotion/import time so
   duplicates never reach the table, or aggregate at query time in
   `buildPolarGrid`. Note that `03` decided sources are never pooled, so this
   is about collisions *within* one source.
2. **What "collision" means** — exact TWS/TWA equality only, or a tolerance.
3. **Which statistic** resolves it.

On (3) there is a framing from `03` worth not losing: this is **not** a second
chance at the target-vs-average question. That one belongs to `07` and applies
at *promotion*, turning a stretch of samples into a point. If promotion has
already applied "target" optimism (`14` measured p90 at +3.1 % and p75 nearly
unbiased at +0.9 %), then re-aggregating with a high statistic at query time
applies it twice. This rule should be deterministic and neutral — median is the
obvious candidate, matching what the clustered path already does.

Cheap to answer; it mostly needs someone to make the call. The evidence is in
`sailplan-app/features/sailPolar/eval/duplicate-speeds.prototype.ts` on branch
`prototype/03-mixed-provenance`.

## Answer

**The bug is worse than the ticket describes, and the headline damage is not a
wrong speed — it is confidence silently collapsing to zero, which disables
polar-based sail suggestion entirely.** The rule is a *structural invariant* on
the grid builders rather than a tie-break fix, and it deliberately stops short
of rewarding duplicates.

Measured on the shipped engine (a clean 2×4 lattice, TWS 8/10 × TWA 60–120,
queried at TWS 9 / TWA 90):

| case | speed | confidence |
| --- | --- | --- |
| clean lattice | 6.700 | **1.000** |
| one row duplicated identically | 6.700 | 1.000 |
| one row tripled identically | 6.700 | 1.000 |
| **every row duplicated identically** | 6.700 | **0.000** |
| every row duplicated 1.0 kn higher | 7.200 | **0.000** |

### 1. Three distinct defects, not one

The ticket found the first. The other two are new.

**(a) Order-dependent speed** — as ticketed, and confirmed.

**(b) The four bilinear corners can come from *different* duplicate sets.**
`bracketAxis` returns the first index ≥ target, so `hiIndex` lands on the
**first** duplicate of the upper value while `loIndex = lo - 1` lands on the
**last** duplicate of the lower value. In the "duplicated 1.0 kn higher" case
above the corners used were `7.4 @80 / 6.6 @100 / 7.8 @80 / 7.0 @100` — the
high row at TWA 80, the low row at TWA 100. The returned surface belongs to
neither stored table. "First row wins" would at least have been coherent.

**(c) Confidence collapses to exactly 0 — the severe one.** Duplicates inject
zero-width gaps into the TWA axis, so `medianAxisGap` returns 0 once half or
more of a column's adjacent gaps are zero, and
`twaGapFactor = min(1, 0 / gap) = 0` zeroes the whole product. Note from the
table that this fires on **byte-identical rows carrying zero conflicting
information**, and that the speed stays *correct* while it happens.

One stray duplicate is harmless (median gap unchanged); wholesale duplication
is fatal. **The realistic trigger is importing the same CSV twice** — a
thoroughly ordinary user action.

**This is functional, not cosmetic.** `suggestionConfig.ts:94` sets
`blend.lowConfidence: 0.25` — "confidence at/below which ranking is pure limits
(w = 0)". Confidence 0 means the suggestion pipeline **ignores the polar table
completely** and ranks on TWA limits alone. Meanwhile the polar screen still
lists every row and the predicted speeds still look right. Nothing tells the
user. A double-imported CSV silently disables polar-based suggestion for every
sail in that file.

Confirmed against the shipped code: the write side has no defence at all.
`sailPolar` is `(id, tws, twa, speed, sailId)` with **no unique constraint**
(`schema.ts:53`); CSV import bulk-inserts every parsed row (`sharing.ts:68`);
manual add inserts unconditionally (`SailPolars.tsx:56`). Nothing dedupes,
upserts, or warns anywhere. The only bulk remedy is "delete all polars for
this sail".

### 2. Decisions

**D1 — A collision is repeat evidence, not an error** (question 1 of the
ticket, answered *A*). Interpolation combines colliding points silently and
losslessly and never treats a collision as a problem. This is forced by `03`:
capture sessions pool with each other, so two sessions landing in the same cell
is the normal, expected case. The "user error" reading is real but belongs to
the **write** side as prevention — see `18`.

**D2 — The rule is a grid-builder invariant, not a tie-break patch.**

> A `PolarGrid` never holds two rows at the same (TWS, TWA) node.

Stated this way it sits upstream of all three defects and fixes them in one
place: bracketing can't pick the wrong row, corners can't be mismatched, and
zero-width gaps become structurally impossible so `medianAxisGap` can no longer
be poisoned. It also makes `buildPolarGrid` match what
`buildClusteredPolarGrid` already guarantees by construction.

*Not* covered by the invariant, and to be fixed alongside as a separate
one-liner: `interpolateSpeed` on the **IDW** path has a smaller version of the
same defect — a point within `EPSILON` of the query returns `point.speed` and
stops, never consulting its twin.

**D3 — Collision means exact equality, never a tolerance** (question 2).
Tolerance-based merging is already `buildClusteredPolarGrid`'s entire job
(1 kn TWS, 4° TWA). Doing it in two places at two widths produces results
nobody can explain. The exact path exists to reproduce hand-entered tables
faithfully and stays exact.

**D4 — Median resolves conflicting speeds at a node** (question 3), matching
the clustered path. The ticket's framing is upheld and worth restating: this is
**not** a second run at the target-vs-average question. That one is `07`'s and
applies at *promotion*. If promotion has already applied optimism, a high
statistic here applies it twice.

**D5 — The collapsed row carries its contributing count `n`.** Both builders
produce it — `buildPolarGrid` where `n` is the duplicate count, and
`buildClusteredPolarGrid` where `n` is the bin population it already computes
and currently discards. One row type, so confidence cannot mean different
things depending on which engine served the query. Cost: the grid's row type
diverges slightly from `PolarPoint`.

**D6 — `n` is carried but NOT spent. Duplicates must never lower confidence;
they do not raise it either.** See below — this is the one place the session
changed its mind.

### 3. Why reinforcement was dropped

Logan's initial position (reasonably) was that identical rows should *reinforce*
a point and raise its confidence. Three findings moved it, and the third is
decisive.

**There is no headroom and no count term.** The bilinear path returns
`clamp01(twsGapFactor × twaFactor × twaGapFactor)` — three purely *geometric*
factors, all exactly 1.0 on a clean lattice. `pointCountScore` exists only in
`computeConfidence`, which serves the **IDW** path. So density could only climb
by lowering the n=1 baseline, which would demote every polar table every
existing user already has — and `blend.highConfidence: 0.7` and
`confidenceTiers.high: 0.65` are calibrated against today's values.

**On the exact path, reinforcement would only ever fire on the error case.**
Exact collisions need equal TWS *and* TWA. Captured points get that only if
`07` decides promotion emits points at bin centres — still open. Imports get it
essentially only by double-import, which `18` now catches at the door.

**Decisive: on the clustered path, `n` is not a duplicate count — it is bin
population, and it is bimodal by provenance.** A 1 Hz race capture puts
hundreds of samples in a 4°×1 kn bin; an imported table puts one. So "`n` raises
confidence" decodes to *"captured data is more trustworthy than imported
data"* — which is exactly `16`'s question, deliberately left open, and which
`03` refused to answer from fixtures because the fixture makes the import
ground truth by construction. `17` sharpens it further: the two sources are on
physically different scales (masthead instrument-corrected vs 10 m
free-stream, 5–9 % TWS and 3–5 ° TWA apart), so this is a real judgement, not a
formality.

Worse than duplicated scope: that judgement already **has** a knob — the blend
weight `w`. Wiring `n` into confidence adds a second one doing the same job,
set implicitly by how many samples a bin happened to collect. That is precisely
the pathology `03` diagnosed and threw out:

> Pooling is already a blend — just an uncontrolled one… it behaves like a
> measured-weight of roughly 0.45 that nobody chose: the emergent result of how
> many points the race produced.

Reinforcement-via-confidence reintroduces it one layer up, in confidence
instead of in speed, where it is harder to see and impossible to sweep.

**Cost of deferring is ~zero.** D5 keeps `n` on the row, so `16` can price it
deliberately against real data if the evidence supports it. And the urgent bug
needs none of it: D2 alone fixes the wrong speed, the mismatched corners, and
the collapse to zero. The position is *"reinforcement is `16`'s to price, and
`15` must not pre-empt it"* — not *"reinforcement is wrong"*.

For the record, the shape `16` would most likely adopt if it does price it
(recorded so the reasoning isn't lost): **ceiling-preserving** — `n` damps the
*gap* factors toward 1 rather than adding a term, so a node backed by 40
samples makes a wide bracket more trustworthy (both endpoints are measured, not
guessed) while a clean lattice stays at exactly 1.0.

### 4. Consequences

- **Existing data self-heals.** The rule is read-side, so duplicate rows
  already sitting in users' databases stop causing harm at the next query. No
  migration, no data loss, nothing destroyed on the write side — which is also
  what D1 demands.
- **`pointsUsed` becomes nodes, not stored rows.** `SailEvaluationCard.tsx:176`
  renders `pointsUsed.length` as "N polar points", so a capture-backed estimate
  may say "4 polar points" while standing on hundreds of samples. The clustered
  path already returns synthetic rows today, so this is not new — only newly
  quantifiable now that `n` exists. **Left as-is deliberately**; surfacing `n`
  waits on `16` deciding whether it means anything.
- **No change to the interpolation *cascade*** — same three engines, same
  order, same fallbacks. Only the grid builders' output contract changes.

### 5. Not implemented here

Per the map's standing preference, this ticket decides and does not build. The
code change is small — the invariant in both builders, the IDW `EPSILON`
one-liner, and tests covering the four rows of the table above — and should be
raised as an ordinary implementation issue outside this map, since it is a
shipped bug that should not wait on the spec being finished.
