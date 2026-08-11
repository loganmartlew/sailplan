# 11 — Polar import batches and duplicate-import prevention

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §10. User stories 94–98.

**What to build:** Re-importing the same polar CSV cannot silently change what
the app suggests. A file that has already been imported is recognised as such,
even after a re-export changed the whitespace, the column casing and the number
formatting. A file that partly overlaps an earlier import says how many rows are
new and how many will be ignored *before* anything is written. And every
successful import is a removable batch, so an import can be taken back out the
way a capture session can.

This matters beyond tidiness: importing the same CSV twice is the mundane trigger
that collapses interpolation confidence to zero (tech-debt `02`). That fix is
read-side; this is the write-side prevention.

**Independent of the capture path.** Can be built in parallel with anything after
`02`.

**Blocked by:** `02`.

**Status:** done

- [x] Every successful CSV import creates a `polarImportBatch`; every inserted
      point links to it; the batch is removable and takes its rows with it
- [x] A **canonical batch fingerprint** over parsed, validated, sail-matched rows
      — so row order, whitespace, header casing, sail-name casing and equivalent
      numeric formatting are all irrelevant
- [x] A **per-observation fingerprint** over normalised timestamp, mapped sail,
      TWS, TWA and boat speed; notes excluded
- [x] Including the timestamp is load-bearing: **two rows with identical values
      at different times are separate observations**, not duplicates —
      collapsing them would discard exactly the repeat evidence `15` protects
- [x] Rows without a valid timestamp remain importable but individually
      uncheckable, and the import result says how many
- [x] A **wholly duplicate** import is blocked with an informational message and
      creates no batch
- [x] A **partially overlapping** import confirms first — *N new rows will be
      imported; M previously imported rows will be ignored* — with Cancel and
      Import N rows. A partial batch owns only the rows it inserted; shared
      ownership is deliberately not modelled
- [x] Comparisons are scoped to **previous import batches for the same boat
      profile** and never touch manual, captured or pre-migration rows
- [x] A corrected re-export is never auto-reconciled: remove the earlier batch,
      then import
- [x] Fingerprinting is pure, lives beside the existing CSV sharing logic in the
      sail-polar feature's `util/`, and is tested input→output
