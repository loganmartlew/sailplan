# 02 — Migration B: the capture schema

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §12.

**What to build:** The database can hold a capture session and everything hanging
off it. Nothing writes to these tables yet — this ticket's whole job is that the
app still opens over a populated database after the migration that rebuilds
`sailPolar`.

**Deliberately one horizontal ticket.** Adding a foreign key to `sailPolar` makes
drizzle-kit drop and recreate the table. Slicing the tables across feature slices
means several rebuilds and several chances to brick startup; doing it once,
against a real populated database, is the entire point of the spec's
two-migration design.

**Note a discrepancy to resolve while building:** §12 says "Nine new tables" but
enumerates eight. Reconcile against §12's bullet list before generating; do not
invent a ninth.

**Blocked by:** `01` — `sourceKind` must already exist on the old table, or the
rebuild's copy statement is invalid.

**Status:** done

- [x] The tables enumerated in §12: `captureSession`, `captureSample`,
      `connectionEvent`, `sailStamp`, `sailedLeg`, `sailSpan`,
      `polarImportBatch`, `plotterSetup` (plus whatever the count discrepancy
      resolves to)
- [x] `captureSample`: only `captureSessionId` and `timestamp` are `notNull` —
      TTL-null means any instrument field may legitimately be absent
- [x] `sailStamp` has **no end-time column**: an interval must be inexpressible
- [x] `sailSpan` carries `[startTime, endTime)` and a **nullable** sail — null is
      "not used". No sample carries a span id
- [x] `captureSession` carries nullable `courseId`, `endedAt`,
      `resumeDismissedAt`, `rawLogPath`, `windFrame`; `status` ∈ {`active`,
      `ended`, `autoEnded`}; `healthCounters` as JSON text
- [x] `plotterSetup` is a 1:1 side table keyed unique on boat profile, so
      "configured" means a row exists
- [x] `sailPolar` gains nullable `captureSessionId`, `importBatchId` and
      `observationFingerprint`
- [x] Indexes per §12, including the **unique** `captureSample(captureSessionId,
      timestamp)` which enforces the one-row-per-coalesce-window invariant
- [x] No `onDelete` cascades and no `PRAGMA foreign_keys` — house convention;
      integrity is explicit fan-out in `api/`
- [x] Models mirror the Drizzle-inferred types with matching Zod schemas
- [x] The generated SQL is read; the `sailPolar` rebuild's `INSERT … SELECT` is
      verified to name `sourceKind` on both sides
- [x] Applied against a **populated** database with existing polar rows; the app
      opens and every polar row survives intact
