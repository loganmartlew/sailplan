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

<!-- filled on resolution -->
