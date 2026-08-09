# 08 — Schema and domain model

Type: grilling
Status: resolved
Blocked by: 05
Map: [map.md](../map.md)

## Question

Turn the founding decisions into concrete Drizzle tables in `schema.ts`, and
name the concepts so the codebase and `CONTEXT.md` agree.

1. **The tables.** Working set:
   - `captureSession` — boat profile (required), name, start/end, notes,
     optional course link, raw-log file reference, status
   - a **sample** table — the fields settled in `05`
   - a **sail stamp** table — timestamp + sail. `09` amended founding decision
     4: this is a bare point in time, **not** an interval and **not** a state
     that holds until the next one. Nothing here should be able to represent an
     end time, or the misattribution `09` forbids becomes expressible.
   - a **polar import batch** — first-class provenance for one successful CSV
     import, removable together with the rows it inserted. `18` requires a
     canonical batch fingerprint, per-observation fingerprints for timestamped
     rows, and a link from each inserted polar point to its batch.
   - a **source/provenance** column on `sailPolar`, per founding decision 5
   - **plotter setup on `boatProfile`** — `11` settled two methods: automatic
     discovery stores the selected source's name/model and caches its latest
     announced endpoint; manual mode pins host/port. Nullable; its absence is
     what gates the start control. Optional testing metadata must not turn
     reachability into a configuration requirement.
   Confirm, correct, or collapse these.
2. **Naming.** What are these called in the ubiquitous language? "Capture
   session" versus "recording" versus "log"; "assertion" versus "sail mark"
   versus **"stamp"** — `09` used *stamp* throughout with Logan and it carries
   the point-in-time meaning better than *assertion*, which reads as a claim
   that persists. Weigh that.
   `CONTEXT.md` is the domain glossary and will need the new terms — the names
   chosen here are the ones the whole feature inherits.
3. **The provenance column's job.** `03` settled that provenance is
   load-bearing for *separation*, not annotation — each source is interpolated
   on its own grid — so it must distinguish imported from captured reliably.
   `18` has now settled that imports are first-class **polar import batches**
   and every newly imported point links to the batch that inserted it; capture
   contributions must likewise remain removable by recording. Decide the
   concrete relational shape: one uniform source abstraction or separate
   import-batch / capture-session references with an explicit source kind.
4. **Existing rows.** Every current `sailPolar` row predates provenance. `18`
   has settled that these rows are grandfathered and excluded from duplicate
   import checks because their observation identity cannot be reconstructed.
   What is their provenance backfill value, and is the column nullable or
   defaulted?
5. **Scoping and integrity.** Sails belong to a boat profile; so does a
   session. What stops a session's assertions referencing a sail from a
   different profile? What happens to a session when its boat profile or a
   referenced sail is deleted?
6. **Indexes.** The sample table is the first genuinely large table in this app
   (thousands of rows per session). What does the review screen query by, and
   what does that imply?
7. **Migration.** Per `AGENTS.md`, `schema.ts` changes require
   `npx drizzle-kit generate`, and migrations are bundled and applied at
   startup by `MigrationGate`. Note anything about this migration that isn't
   routine.

Use `/domain-modeling` alongside `/grilling` here — this ticket adds
vocabulary, not just columns.

> **`05` has settled the sample row's contents** — see its answer for the field
> table and the rationale. This ticket takes that as given and owns the
> *schema*: table shapes, keys, indexes, migrations and the domain vocabulary.
> Beyond the sample table, `05` requires **session-level** state that has no home
> yet:
>
> - a **wind classification** (`water` / `ground` / `instrument-corrected` /
>   `unknown`), computed once per session at analysis time (`05` §6, `17`)
> - **per-sentence-type reject counters** and **per-field stale counters**
>   (`05` §5) — surfaced in review as session health
> - a **connection-event log** (disconnect/reconnect), which is deliberately
>   *not* rows in the sample table (`05` §5)
> - a **confidence flag** for light-air sessions (below ~6 kn TWS)
>
> Naming these is this ticket's job: "sample", "session", and whatever the
> connection log and classification end up called, belong in `CONTEXT.md`.
>
> **`11` adds lifecycle state this schema must be able to express:** active;
> deliberately ended; auto-ended after five minutes without data but still
> resumable; and confirmed/promoted. Resuming reopens the same recording and
> preserves the outage as a connection-event gap. The resumable affordance
> expires on dismissal, another recording starting, or confirmation/promotion;
> decide here which parts are durable state versus derived/transient state.

## Answer

Settled by grilling. Two ideas run through every sub-answer. **Evidence is
immutable and claims are mutable** — samples and stamps are written once and
never edited, while legs and spans are the editable claims laid *over* them by
time range, so review never rewrites what the instruments said. And **the
provenance column is a read-path predicate, not a relationship** — `03` asks
"captured or not?" on every suggestion, which wants an indexed column on
`sailPolar`, not a join.

### 1. Vocabulary

The feature is **capture**. Its artifact is a **capture session**; *recording* is
demoted to the verb and the live status only ("Record this course",
"Recording…", "Recording ended") and is never a noun you can delete. *Race* does
not enter the model at all — a session may be a race, a practice or a delivery,
so "race" is only ever what the sailor types into the session's `name`.

A **capture session is one start→stop.** Ideally that is one race; nothing
enforces it, and a session that accidentally spans two races (engine on between
them, no headsail) is cleaned up in review by marking those spans *not used*.
A five-minute dropout auto-ends a session but `11`'s resume reopens **the same
one**, so a session is emphatically not one continuous connection.

The consequence is accepted deliberately: **withdrawal granularity is the whole
session**. A session holding a good race and a bad one is all-or-nothing under
`06`. Review already prevents the bad race reaching promotion at all, so this
only bites on a promotion regretted after confirming — and per-leg reversal
(`10`'s designed-but-unbuilt stub) is a better answer than inventing a
session-splice operation for a case you avoid by stopping the recording.

New terms, all now in `CONTEXT.md`: **capture session**, **capture sample**,
**sailed leg**. Existing entries for *sail stamp*, *sail-attribution span* and
*raw log* were reworded off the noun "recording".

**`sailedLeg`, not `leg`.** `CONTEXT.md` already defines a leg as the straight
sail from one mark to the next — *planned*, exact, named by its marks. `10`
detects legs from median `|TWA|` with **no course loaded**, at a median 33 s
error, and a dropout can split one beat into two. Same real-world thing,
different object: one is planned, the other observed. Keeping the words apart is
what makes `sailedLeg.courseMarkId` — the optional link that supplies a mark
name — expressible rather than confusing, and Logan notes it is also the hook
the separate **via marks** feature needs.

### 2. The tables

Nine new tables, plus four columns on `sailPolar`. `↦` marks a foreign key.

**`captureSession`** — `boatProfileId`↦, `name`, `courseId`↦ *nullable*,
`startedAt`, `endedAt` *nullable*, `status`, `resumeDismissedAt` *nullable*,
`rawLogPath` *nullable*, `windFrame` *nullable*, `healthCounters` (JSON text),
`notes`.

`courseId` stays **nullable whichever way the map's course-less-session fog
resolves** — that is a UX question about where a Start control lives, and
nullable costs nothing today while mandatory would need a migration to undo.

**`captureSample`** — `captureSessionId`↦, `timestamp`, then `05`'s fields:
`gpsTime`, `tws`, `twa` (signed ±180°), `twd`, `stw`, `sog`, `cog`, `hdg`,
`variation`, `awa`, `aws`, `heel`, `trim`, `lat`, `lon`, `rawOffset`. **Only the
session and the timestamp are `notNull`** — TTL-null means any instrument field
can legitimately be absent. Named `captureSample` rather than `nmeaSample`: the
row is deliberately *not* NMEA (units converted, angles rotated to true north,
status-`V` rejected, no derived values), the verbatim wire data is the raw log,
and `06` works hard to keep those two apart in the sailor's head. It also keeps
one prefix across the feature instead of two.

**`connectionEvent`** — `captureSessionId`↦, `at`, `kind`.
**`sailStamp`** — `captureSessionId`↦, `sailId`↦, `timestamp`. No end time is
expressible, per `09`.
**`sailedLeg`** — `captureSessionId`↦, `ordinal`, `startTime`, `endTime`,
`name` *nullable* ("Beat 3" until renamed), `courseMarkId`↦ *nullable*,
`confirmedAt` *nullable* (`19`'s pager confirmation).
**`sailSpan`** — `sailedLegId`↦, `startTime`, `endTime`, `sailId`↦ ***nullable*
— null is "not used"**.
**`polarImportBatch`** — `boatProfileId`↦, `importedAt`, `fileName`,
`batchFingerprint`, `rowCount`.
**`plotterSetup`** — `boatProfileId`↦ unique, `mode`, `sourceName`,
`sourceModel`, `cachedHost`, `cachedPort`, `host`, `port`, `lastTestedAt` — all
mode-specific fields nullable.

`plotterSetup` is a 1:1 side table rather than six nullable columns on
`boatProfile` so that **"configured" means a row exists** — one unambiguous gate
for `09`'s Start control, instead of "which of six nullable columns count?". It
also keeps `11`'s rule structurally visible: `lastTestedAt` sits *beside* the
setup and is never part of what makes it valid.

Two calls made without a separate question. `05`'s **light-air low-confidence
flag is derived, not stored** — it is a threshold over the session's own
samples, and freezing "~6 kn" into a column is the formula-versioning trap `05`
§3 rejected. And the table is **`sailSpan`** though the glossary term is
*sail-attribution span*: the long form is the concept, the short form is the
table, exactly as `sailPolar` is the table for *polar point*.

### 3. Spans claim time, not rows

A sail-attribution span carries `[startTime, endTime)` and **no sample carries a
span id**. Samples are immutable evidence; spans are the mutable claim. A schema
where dragging a divider in `10`'s review rewrites 400 sample rows has confused
the two. The unique index on `(captureSessionId, timestamp)` makes the half-open
range scan free, and `19`'s **not used** then needs no representation at all: a
sample in no span's range is unattributed, which is the safe default `09`
demanded.

For the same reason, **review edits spans, never stamps.** Stamps are
append-only evidence — deletable if you tapped the wrong sail, but never
*created* by review, because a review-time correction that manufactures a stamp
launders an inference into evidence, and that distinction is the whole of `19`.
So no `source` column on `sailStamp`: there is only ever one source.

**Legs and spans are stored, not recomputed on open.** Materialised the first
time review is opened. Confirmation is per-leg, so it needs a durable home; and
once spans are stored, recomputing legs underneath them would orphan them the
moment `10`'s 25°/±90 s constants are retuned. Storing them makes detection a
one-time act with a record, rather than a function whose output silently moves
between app versions.

### 4. Lifecycle: three states, everything else derived

Durable: `status` ∈ {`active`, `ended`, `autoEnded`} plus a nullable
`resumeDismissedAt`. Derived: **resumable** = `autoEnded` ∧ no
`resumeDismissedAt` ∧ no later session ∧ nothing confirmed; **confirmed/
promoted** = the legs' confirmation state, not a fourth status. `11`'s
resumability expires on three conditions, and three of them are already
queryable facts — a status enum obliged to stay transactionally correct against
external state is a bug farm.

### 5. Provenance: `sourceKind` plus two nullable references

`sailPolar` gains `sourceKind` (`notNull`), `captureSessionId`↦ *nullable*,
`importBatchId`↦ *nullable*, and `observationFingerprint` *nullable*.

Rejected: a uniform `polarSource` table with a kind and nullable back-refs. The
separation `03` demands is a predicate on every interpolation, which wants a
plain indexed column, not a join through a polymorphic table — and import
batches and capture sessions have nothing in common except removability, so the
shared abstraction buys one column and costs a join forever.

**No promotion batch.** A promotion does not get its own provenance record the
way an import does: `06` already scopes withdrawal to the whole session, and a
second promotion from the same session should *replace* its points, not
accumulate a second batch.

**`sourceKind` ∈ {`manual`, `import`, `capture`}, defaulting to `manual`.** A
`legacy` value was proposed and dropped by Logan: on any other codebase
back-filling unknown-provenance rows to `manual` would be recording a wrong
answer irreversibly, but he is the only user, has imported no polars, and knows
the existing rows *are* hand-entered — so the unknown isn't unknown. Residual
risk, accepted and mitigated: a writer that forgets `sourceKind` produces an
invisible `manual` row, so the Drizzle column is `.notNull()` **with no
`.default()`** (the DDL default exists purely to backfill), and import and
promotion each go through a single insert path.

The load-bearing consequence: the read side asks **`sourceKind = 'capture'`**.
One predicate, and every future non-capture kind lands on the correct side of
`03`'s never-pool line automatically.

`18`'s per-observation fingerprints live in a nullable column **on `sailPolar`**,
not a side table. `NULL` is meaningful — `18` makes undateable rows importable
but uncheckable — so the nullable column *is* the model, and non-import rows are
`NULL` for the same honest reason: no timestamp, no observation identity.

**`n` is not stored.** `07` proposes points from ≥30 samples and `10` shows a
count, but `15` explicitly declined to *spend* `n` (it would decode to "captured
beats imported", which is `16`'s question and a second implicit trust knob), so
a stored `n` is a column nothing reads. It stays recomputable for as long as the
point exists, because `06` deletes points with their session — and adding a
column to `sailPolar` drags in CSV import/export, the blast-radius argument `07`
used to refuse a `tack` column.

### 6. Indexes

`captureSample(captureSessionId, timestamp)` **unique** — enforces `05`'s
one-row-per-coalesce-window invariant *and* is the covering index for review's
only access pattern. Then `sailedLeg(captureSessionId, startTime)`,
`sailSpan(sailedLegId)`, `sailStamp(captureSessionId, timestamp)`, and
**`sailPolar(sailId, sourceKind)`** — `03`'s per-source grid build, which runs on
every suggestion and is the only new index that is not an ownership lookup.
Plus `sailPolar(observationFingerprint)` for `18`'s partial-overlap check.

Deliberately **not** indexed: `sailPolar.captureSessionId` / `importBatchId`.
Read once, at deletion, on a table of hundreds of rows.

Keys are the ordinary `integer('id').primaryKey()` rowid alias everywhere, like
every existing table — including `captureSample`, where a composite key would
buy nothing the unique index does not already give.

### 7. Integrity: enforced in the writer, by the house convention

Checked against the code rather than assumed: this app declares **no
`onDelete` cascades and never sets `PRAGMA foreign_keys`**. Foreign keys are
documentation; every parent delete fans out explicitly in application code
(`features/sail/api/deleteSail.ts` removes polars and limits before the sail;
`deleteCourse.ts` the same for `courseMark`). Capture follows it:

- deleting a **capture session** removes its spans, legs, stamps, connection
  events, samples and promoted polar points, in one transaction (`06` already
  requires the transaction for the raw-log case);
- deleting a **sail** additionally removes stamps and spans referencing it, on
  top of the polars and limits already handled;
- deleting a **boat profile** fans out to its sessions.

**Cross-profile integrity is enforced in the writer, not the schema.** Nothing
creates a stamp except `09`'s sail sheet, which lists only the session's
profile's sails. A composite foreign key would work but requires denormalising
`boatProfileId` onto every stamp and span — a column on the two most-edited
tables to defend a path that does not exist.

### 8. Migration: two, deliberately ordered

This is the non-routine part, and it is worse than it looks.
`drizzle/0006_busy_red_hulk.sql` is the precedent: SQLite cannot add a foreign
key in place, so drizzle-kit **drops and recreates the table** —
`CREATE TABLE __new_course`, `INSERT … SELECT`, `DROP`, `RENAME`. Adding
`captureSessionId` and `importBatchId` will do that to `sailPolar`, at startup,
behind `MigrationGate`, which blocks the UI until migrations apply. A migration
that throws is an app that will not open.

**The trap:** a new column and a new foreign key in the *same* migration makes
the generated `INSERT … SELECT` name `sourceKind` on both sides — selecting it
from the old table, where it does not exist yet.

1. **Migration A — `sourceKind` alone.** A plain
   `ALTER TABLE sailPolar ADD sourceKind text DEFAULT 'manual' NOT NULL`,
   precedented exactly by `0003`'s `masthead`.
2. **Migration B — everything else.** Nine tables, `observationFingerprint`, the
   two foreign-key columns, the indexes. By now `sourceKind` exists on the old
   table, so the rebuild's copy statement is valid by construction rather than
   by luck.

Read the generated SQL before trusting it, and test against a populated database
rather than an empty one.

The foreign keys are declared despite the rebuild, rather than dropping to plain
`integer` columns: the constraint is unenforced either way, but every other
table uses `.references()`, and a lone exception is the sort of inconsistency
someone later tidies up — triggering this same rebuild at a worse moment, when
`sailPolar` is full of promoted points instead of a hand-entered handful. It is
cheapest today and never gets cheaper. Logan asked that the general concept be
written down; it now lives in
[`docs/data-layer.md`](../../../sailplan-app/docs/data-layer.md#adding-a-foreign-key-rebuilds-the-whole-table),
with the correction that rows *are* copied — the hazards are the failed-copy
trap above and the untransacted `DROP`, not data loss by default.

### Consequences for other tickets

- No new tickets, and nothing graduates from the fog. The course-less-session
  question stays fog: `courseId` is nullable either way.
- `16` inherits `sourceKind = 'capture'` as the separation predicate its blend
  weight will be applied across.
- The spec now has every persisted shape it needs; what remains open on the map
  is the boat (`04`, and `16` behind it) and the device spike (`13`).
