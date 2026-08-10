# 05 — Parse the stream into capture samples

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §3, plus Testing Decisions
Seam 1.

**What to build:** The sentence stream becomes rows the rest of the feature can
reason about — one per second, every angle true-north, every speed in knots, a
field that stopped arriving written `NULL` rather than repeated forward. A
corrupt transducer sentence costs a heel reading, never a wind sample. Nothing is
visible to the sailor yet; this is the layer everything downstream replays
against.

The whole of it is reachable through **one pure entry point** so it can be tested
against real simulator output and ground truth with no device, socket or
database:

```
replayCaptureSession({ sentences, stamps, courseMarks?, spanEdits? })
  → { samples, health, windFrame, … }
```

Stage functions stay exported and individually callable — the app needs them
separately at runtime — but tests prefer the top.

**Blocked by:** `02`, `04`.

**Status:** ready-for-agent

- [ ] `replayCaptureSession` lives in the capture feature's `util/`, is free of
      React and database access, and returns `samples`, `health` and `windFrame`
      at this stage
- [ ] Validation runs at the parse boundary **before any unit conversion**:
      checksum, field count, numeric parse, per-field range, status flag
- [ ] **Row-level rejection for anchors, field-level for everything else** — a
      row whose wind is corrupt is not a sample of anything
- [ ] Status `V` is a rejection, **never a zero**
- [ ] Over-length lines are **counted, not rejected** (5 % of a valid real stream
      breaks the 82-character limit)
- [ ] `MWV` is parsed on its **flag field**, not on the sentence — reading
      apparent and true as one stream is a silent, plausible bug
- [ ] Emission is anchor-triggered on `MWV,T` **or** `VHW`, collecting whatever
      lands within a **250 ms coalesce window**, minimum **750 ms** between rows
- [ ] Sample fields exactly per §3's table; `twa` **signed ±180°** (positive =
      starboard); stored `REAL` with no rounding; **no derived columns**
- [ ] `timestamp = sessionStartWallClock + monotonicElapsedMs` — absolute epoch
      ms, always present, immune to the wall clock stepping on an NTP sync
- [ ] `variation` is `NULL` when unavailable, **never a silent 0**
- [ ] Staleness is **TTL-null** at `max(1 s, 3 × nominal period)`; a stale field
      is `NULL`, never repeated forward
- [ ] Gaps are **absent rows plus `connectionEvent` rows** — no marker rows, no
      manufactured empty samples
- [ ] Per-sentence-type reject counters and per-field stale counters accumulate
      on the session
- [ ] Wind frame classified per session (`water` / `ground` /
      `instrument-corrected` / `unknown`) by deriving true wind twice and
      recording which one `MWV,T` tracks. **Derived and instrument values are
      never blended**
- [ ] Session creation is now gated on valid NMEA anchor data arriving; the raw
      log still opens on socket connect (`04`'s raw-first rule is unchanged)
- [ ] Samples are written to SQLite off the socket `data` event with no drops at
      twice race volume

Tested against, all of it already existing:

- [ ] the real Navico GoFree capture — 142 corrupt `VLW` sentences, `-1.-3` where
      a number belongs, 331 over-length lines counted not rejected
- [ ] the fault script holding boat speed stale 90 s → **90 rows with `NULL` boat
      speed and intact wind**
- [ ] a status-`V` sentence → rejected, never a 0 kn sample
- [ ] a TCP-split sentence → rejected, not parsed one field out of register
- [ ] two unaligned 1 Hz anchors → a true 1 Hz row rate, not 2.4 Hz of
      near-duplicates
- [ ] a dropout → absent rows, a connection event, no manufactured rows, and no
      smoothing across the >5 s discontinuity
