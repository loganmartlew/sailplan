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
   - a **sail assertion** table — timestamp + sail, per founding decision 4
   - a **source/provenance** column on `sailPolar`, per founding decision 5
   Confirm, correct, or collapse these.
2. **Naming.** What are these called in the ubiquitous language? "Capture
   session" versus "recording" versus "log"; "assertion" versus "sail mark".
   `CONTEXT.md` is the domain glossary and will need the new terms — the names
   chosen here are the ones the whole feature inherits.
3. **The provenance column's job.** Is it an annotation (`'manual' | 'import' |
   'capture'`) or a real foreign key to `captureSession`? A FK makes "undo this
   session" trivial but constrains deletion order. **`03` may change this
   answer** — if mixed sources hurt interpolation, provenance may need to
   *segregate* data rather than merely label it.
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

## Answer

<!-- filled on resolution -->
