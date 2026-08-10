# 01 — Migration A: `sourceKind` on `sailPolar`

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §12.

**What to build:** Every polar point in the app knows where it came from. The
sailor sees no change — their hand-entered polars open and work exactly as
before — but from now on a row imported from a CSV is distinguishable from one
typed in by hand, which is what the never-pool read path and promotion both
stand on.

This migration lands **alone**, carrying nothing else. Adding a foreign key to
`sailPolar` makes drizzle-kit drop and recreate the table; a new column and a new
foreign key in the *same* migration make the generated `INSERT … SELECT` name
`sourceKind` on both sides and select it from the old table, where it does not
exist. A failed migration is an app that will not open.

**Blocked by:** None — can start immediately. (Assumes tech-debt `02`, the
grid-builder duplicate invariant, is already landed.)

**Status:** ready-for-agent

- [ ] `sailPolar.sourceKind` exists, `notNull`, values `manual` | `import` | `capture`
- [ ] **No ORM-level default** — the DDL default exists purely to backfill, so a
      writer that forgets the column fails loudly
- [ ] The generated migration is a plain `ALTER TABLE … ADD COLUMN` and contains
      nothing else: no foreign key, no second column, no index
- [ ] Every existing row backfills to `manual` (no `legacy` value — sole user,
      nothing imported, so the unknown is not unknown)
- [ ] CSV import writes `import`; manual add writes `manual`; each goes through a
      single insert path that sets it explicitly
- [ ] The generated SQL is read and understood before it is trusted
- [ ] Applied against a **populated** database — a real device DB with existing
      polar rows, not an empty one — and the app opens
- [ ] Full suite green; existing polar tests keep their contract
