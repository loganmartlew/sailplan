# 08 — Schema and domain model

Type: grilling
Status: open
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
   - a **source/provenance** column on `sailPolar`, per founding decision 5
   - **plotter connection config on `boatProfile`** — host, port, device name,
     NMEA version (`09`, via `11` q2). Nullable; its absence is what gates the
     start control.
   Confirm, correct, or collapse these.
2. **Naming.** What are these called in the ubiquitous language? "Capture
   session" versus "recording" versus "log"; "assertion" versus "sail mark"
   versus **"stamp"** — `09` used *stamp* throughout with Logan and it carries
   the point-in-time meaning better than *assertion*, which reads as a claim
   that persists. Weigh that.
   `CONTEXT.md` is the domain glossary and will need the new terms — the names
   chosen here are the ones the whole feature inherits.
3. **The provenance column's job.** Is it an annotation (`'manual' | 'import' |
   'capture'`) or a real foreign key to `captureSession`? A FK makes "undo this
   session" trivial but constrains deletion order. **`03` settled the first
   half:** provenance is load-bearing for *separation*, not annotation — each
   source is interpolated on its own grid — so it must at minimum distinguish
   imported from captured reliably. **`18` sharpens the second half:** if
   imports also become first-class batch records, provenance is one uniform
   concept (every row points at the batch that created it, import or capture)
   rather than two. Resolve `18` first if you can — it is small and unblocked,
   and deciding it after this ticket means a second migration.
4. **Existing rows.** Every current `sailPolar` row predates provenance. What's
   the backfill value, and is the column nullable or defaulted?
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

## Answer

<!-- filled on resolution -->
