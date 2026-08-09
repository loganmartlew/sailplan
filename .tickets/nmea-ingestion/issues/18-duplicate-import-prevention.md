# 18 — Should re-importing the same CSV be prevented?

Type: grilling
Status: resolved
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

### Decision

Prevent duplicate **observations**, including partial overlap with earlier CSV
imports. Do not treat every colliding polar point as a duplicate: two distinct
measurements may legitimately have the same TWS, TWA and speed, and manual or
captured measurements remain independent evidence even when their values match
an imported observation.

Every successful import becomes a first-class **polar import batch**. Each
inserted polar point belongs to the batch that inserted it, so that batch's
contribution can be removed without deleting a sail's other polar data.

### Duplicate identity

Detection has two levels:

1. A **canonical batch fingerprint** detects a wholly repeated effective
   import. It is computed from the parsed, validated and sail-matched rows, not
   the raw file bytes. Canonicalisation makes CSV row order, whitespace, header
   casing, sail-name casing and equivalent numeric formatting irrelevant.
2. A **per-observation fingerprint** detects partial overlap. For rows with a
   valid timestamp, identity is the normalized timestamp, mapped sail, TWS,
   TWA and boat speed. Notes are excluded because they do not change the polar
   contribution. The fingerprint is retained with the imported contribution
   and its batch provenance.

Including the timestamp is load-bearing. Two rows with identical numeric
values but different timestamps are separate observations, not duplicates;
collapsing them would discard the repeat evidence protected by [What should
interpolation do when stored points collide?](15-duplicate-point-collision.md).

Rows without a valid timestamp remain importable, but cannot safely be checked
for partial overlap. They participate in the canonical whole-batch fingerprint
and the import result reports how many could not be checked individually.

Duplicate comparisons are scoped to observations belonging to previous polar
import batches for the same boat profile. They do **not** compare against
manual polar points, capture-derived points, or pre-migration rows. Existing
rows are grandfathered because the timestamp and provenance needed to
reconstruct their observation identity have already been discarded.

### Import behaviour

- A clean import proceeds normally.
- If an import contains both new and previously imported observations, show a
  confirmation before writing: **N new rows will be imported; M previously
  imported rows will be ignored**. The actions are Cancel and Import N rows.
- If every eligible observation is already imported, block the import with an
  informational message and create no batch.
- A partially overlapping batch owns only the rows it actually inserts. If the
  earlier batch that owned the skipped rows is later removed, those rows
  disappear; shared ownership is deliberately not modelled in v1.
- Removing a polar import batch removes only its inserted rows.
- A corrected re-export is never reconciled or treated as a replacement
  automatically. The sailor removes the earlier batch and then imports the
  corrected file.

### Scope and consequences

This replaces the ticket's original "hash each CSV and warn" proposal. A raw
file hash cannot recognize formatting-only changes and a single batch hash
cannot identify partial overlap; canonical batch and observation fingerprints
are both required.

First-class import batches are accepted despite the additional scope because
they make imported polar contributions reversible in the same product sense as
captured contributions. This does not require both to share one physical table;
[Schema and domain model](08-schema-and-domain-model.md) owns the concrete
Drizzle shape and the wider provenance model.

The read-side grid collision fix decided by [What should interpolation do when
stored points collide?](15-duplicate-point-collision.md) remains necessary.
That ticket recorded a decision, not an implementation: duplicate rows still
break confidence in the current shipped code, and even after the fix,
multiplicity can affect the median when different speeds collide at one node.
