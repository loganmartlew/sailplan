# 15 — What should interpolation do when stored points collide?

Type: grilling
Status: open
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

<!-- filled on resolution -->
