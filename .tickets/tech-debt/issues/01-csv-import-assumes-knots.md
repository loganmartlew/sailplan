# 01 — Polar CSV import silently assumes knots

Status: needs-triage

## The gap

Every speed written to the database is canonically **knots** — `speedUnit` is an
entry/display preference only (see the Units note in
[`CONTEXT.md`](../../../CONTEXT.md#polars)). Every write path converts:
`NewSailPolarDialog.tsx:114-116`, `twa-limits.tsx:65-70` (`boundToKnots`),
`TrueWindInputCard.tsx:24`.

**CSV import is the one writer that does not.**
[`features/sailPolar/util/sharing.ts:53-65`](../../../sailplan-app/features/sailPolar/util/sharing.ts)
calls `parseFloat` on the `tws` and `speed` columns and inserts the result
directly, with no unit conversion and no unit declared in the file format. A CSV
exported from a tool working in km/h imports as knots — the numbers are ~1.85×
too large and nothing anywhere says so.

## Impact

Silent, not loud. The import succeeds, the polar chart renders, and the boat's
performance model is wrong by a constant factor. Sail suggestion then compares a
mis-scaled sail against correctly-scaled ones.

Low likelihood while the only real source of CSVs is the app's own export (which
writes knots, so round-trips are correct) — but there is nothing preventing
hand-authored or third-party files.

## Options

1. **Document only** — state "speeds must be in knots" in the import dialog copy
   and in the exported file's header comment. Cheap; no schema or format change.
2. **Unit picker on import** — let the user declare the file's unit and convert.
   Correct, but adds UI and a format question (does export then write a unit
   header?).
3. **Unit column in the CSV format** — self-describing files, but breaks
   compatibility with existing exports.

Option 1 is the proportionate fix unless CSV import gets used more widely.

## Provenance

Surfaced while resolving
[nmea-ingestion 05 — What is a sample row](../../nmea-ingestion/issues/05-sample-fields-and-rate.md),
which needed to establish the canonical storage unit before deciding what a
captured sample row stores. Not part of that map's destination, so it was logged
here instead.
