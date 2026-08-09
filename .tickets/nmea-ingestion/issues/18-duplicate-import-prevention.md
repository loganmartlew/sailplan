# 18 — Should re-importing the same CSV be prevented?

Type: grilling
Status: open
Blocked by: —
Map: [map.md](../map.md)

## Question

Surfaced while resolving [15](15-duplicate-point-collision.md) (Logan's
proposal). `15` decided that interpolation treats colliding points as **repeat
evidence** and combines them silently — it never treats a collision as an
error. That is the right call for the read side, but it means the *genuine*
error case has no defence anywhere:

**Importing the same CSV twice is currently silent and free.** `sharing.ts:68`
bulk-inserts every parsed row with no unique constraint on `sailPolar`
(`schema.ts:53`) and no record of which file a row came from. Before `15` this
was catastrophic (confidence collapsed to 0, disabling polar-based suggestion
for every sail in the file — see `15`'s answer). After `15` it is harmless to
correctness, but it still silently doubles the row count, and the only bulk
remedy is "delete all polars for this sail".

Proposal: **store a hash of each imported CSV**; if a file with the same hash
is imported again, warn.

Decide:

1. **Warn, block, or replace?** A warning the user can override is the least
   presumptuous, but "replace the previous import from this file" may be what
   they actually want — especially for a corrected re-export of the same
   table.
2. **What is hashed** — the raw file bytes, or the parsed rows? Byte-hashing is
   trivial but misses a re-export that differs only in whitespace, header
   casing, or row order. Row-hashing catches those but needs a canonical form.
3. **Where the hash lives.** This is import provenance — *which file did this
   row come from* — which overlaps `08`'s provenance column, currently scoped
   as `'manual' | 'import' | 'capture'` or a FK to `captureSession`. Does an
   import become a first-class record (an `importBatch` row, mirroring
   `captureSession`) so that "undo this import" works the same way "undo this
   session" does? That symmetry is appealing and would make `08`'s provenance
   column uniformly a FK. It is also more than a hash column.
4. **Scope check.** Is per-file undo worth it, or is warn-on-duplicate-hash
   enough for v1? Note the app currently has no undo for imports at all.

**Why it is on this map rather than outside it.** The mechanism is generic
import hygiene, but question 3 is genuinely `08`'s — this decides whether
provenance is one uniform concept (every row points at the batch that created
it, whether an import or a capture) or two different ones. Worth settling
before `08` freezes the schema.

Cheap, needs no hardware, and independent of everything the NMEA feature is
waiting on.

## Answer

<!-- filled on resolution -->
