# 05 — What is a sample row, and how often do we write one?

Type: grilling
Status: resolved
Blocked by: 01
Map: [map.md](../map.md)

## Question

Founding decision 3 says capture near the native rate and average at analysis
time. Settle the row shape on `01`'s documented behaviour; `04` later confirms
it against the real boat and may force a revision. Do **not** wait for `04` —
boat access is scarce and this ticket is on the critical path.

### What `01` already settled

- **Rate: 1 Hz, without qualification.** Every polar-relevant sentence
  (`MWV`, `MWD`, `VHW`, `VTG`, `RMC`) is emitted at 1 Hz. "Native rate" and
  "1 Hz" are the same decision — no faster wind or boat-speed data exists to
  discard. `HDG` is 10 Hz and `GGA`/`GLL` 5 Hz; the raw log preserves those if
  a later ticket wants them. **Question 3 below is therefore mostly answered**
  — what remains is the fixed-clock-versus-complete-set choice.
- **True wind arrives directly** as `MWV` with the `T` flag, plus `MWD` for
  TWD. No apparent→true derivation needed. `VWR`/`VWT` are never emitted.
- `HDT` is receive-only — true heading must be derived from `HDG` magnetic
  plus variation, if it's needed at all.

### What `01` added to this ticket

- **Which true-wind reference frame do we trust?** 0183's single `T` flag
  cannot distinguish water-referenced from ground-referenced true wind. Polars
  need **water-referenced**; ground-referenced bakes in tidal current and
  skews every derived polar in a tideway. Decide what the app does when it
  cannot tell which it's receiving — trust it, warn, require a user
  declaration per boat, or detect it by other means. `04` measures which one
  this plotter actually sends.
- **Store apparent as well as true?** `01` recommends yes: log `MWV,R`,
  `MWV,T` and `MWD`, derive polars from `MWV,T`, but keep apparent so a later
  ticket can re-derive true wind independently if the instrument's trig proves
  suspect. That's a recommendation, not a decision — question 2 below owns it.
- **Parse on the flag, not the sentence.** `MWV` carries both frames and
  differs only in field 2. Reading it as one stream is a silent, plausible
  bug that would mix apparent and true speeds into the same column.

1. **The fields.** Which columns does a sample row carry? The working set is
   time, TWS, TWA, boat speed, SOG, COG, heading, latitude, longitude. For each:
   is it needed for polar derivation, needed for review/scrubbing, or merely
   nice to have? Fields that are only nice to have cost storage on every row
   forever.
2. **True vs apparent.** Given `01`/`04`'s finding, do we store what the
   instrument gives us, our derived values, or both? Storing both is honest
   about provenance and lets a derivation bug be fixed later without a
   re-record — but it widens every row.
3. **The rate.** Settled at 1 Hz by `01`. What remains: do we emit a row when a
   "complete enough" set of sentences has arrived, or on a fixed clock carrying
   the most recent value of each field?

   **`02` constrains this hard: JS timers do not run while backgrounded.**
   `JavaTimerManager.onHostPause()` removes the Choreographer callback that
   drives `setTimeout`/`setInterval`, so a fixed-clock model cannot be built in
   JavaScript — it needs a native Kotlin tick. The event-driven model (emit on
   sentence arrival) has no such requirement. This is an architectural
   difference, not an implementation detail, and it should weigh on the choice.
   `13` step 4 confirms the behaviour on real hardware.
4. **Staleness.** If heading stops updating but wind keeps arriving, a
   fixed-clock row silently repeats a stale heading. Does a row record the age
   of each field, or does the recorder mark rows as degraded, or do we accept
   it?
5. **Gaps.** How is a dropout represented — absent rows, or an explicit gap
   marker? Founding decision 6's reconnect behaviour must not let the analysis
   step interpolate across a hole it can't see.
6. **Units.** The app has a user `speedUnit` setting; NMEA has its own unit
   conventions per sentence. Where does conversion happen, and what is stored?

> **Three things `14` handed this ticket, all measured rather than argued:**
>
> - **The real capture is already malformed.** In Signal K's
>   `gofree-merrimac.log` — a genuine Navico GoFree stream, no fault injection
>   — *all 142* `$SDVLW` sentences are corrupt (`$SDVLW,$SDVLW,,N,…`),
>   `$IIXDR` carries `-1.-3` where a number belongs, and 331 of 6323 lines
>   break NMEA's 82-character limit. Sentence-level validation is a **v1
>   requirement**, not a hardening pass. Question 6's conversion step must
>   never see an unvalidated field.
> - **The wire costs a tenth before the app does anything.** Reducing `MWV,R`
>   + `VHW` back to true wind recovers `MWV,T` to 0.106° mean / 0.423° max and
>   0.034 kn mean — pure 1-dp quantisation in the sentences. Worth knowing when
>   deciding what precision a sample row stores.
> - **Question 4 is now testable, not hypothetical.**
>   `node nmea-sim.js sail --script scripts/nasty.json` holds `VHW` stale for
>   90 s while `MWV` keeps flowing, and emits the status-`V` "I have no data"
>   form. Whatever this ticket decides, run it against that script before
>   calling it settled.

## Answer

**A sample row is a snapshot of every instrument value, in canonical units,
emitted when wind or boat speed arrives — carrying `NULL` wherever a sentence
has stopped arriving, and never a derived value.**

Six decisions, in the order they constrain each other.

### 1. Emission — anchor-triggered, with a coalesce window

A row is opened by the arrival of **either** `MWV,T` **or** `VHW`, collects
whatever else lands within a **250 ms coalesce window**, then flushes with the
most recent value of every field. Minimum **750 ms** between rows.

- **No native tick is required.** This is the decisive property. `02` found
  `JavaTimerManager.onHostPause()` removes the Choreographer callback driving
  `setTimeout`/`setInterval`, so a fixed-clock recorder cannot exist in
  JavaScript — it needs Kotlin. Event-driven emission has no such requirement,
  which removes an entire native component from v1.
- **Two anchors, not one.** A single anchor goes silent when its sentence dies;
  `MWV,T` + `VHW` means the recorder keeps producing rows if either wind or
  boat speed survives.
- **The coalesce window is what makes two anchors safe.** `MWV,T` and `VHW` are
  both 1 Hz but *not phase-aligned*, so a naive "emit on any anchor" fires
  2–3 rows/second — mostly near-duplicates where one field moved and the rest
  are copies. The recording silently becomes 2.4 Hz of repeats, and every
  downstream median is then weighted by **sentence timing** rather than by
  time. Coalescing collapses that back to a true 1 Hz.
- **Rejected: "complete set".** Waiting for every field to refresh means
  `nasty.json`'s 90 s `VHW` freeze produces **zero rows for 90 seconds**,
  discarding 90 seconds of perfectly good wind data.
- **Rejected: `RMC`/`GGA` as anchors.** A row with neither wind nor boat speed
  contributes nothing to a polar, and position survives in the raw log.

### 2. Fields

Every angle **true-north referenced**, every speed in **knots**, stored as
`REAL` with **no rounding** (the wire already costs 0.106° / 0.034 kn to 1-dp
quantisation per `14`; app-side rounding compounds it for nothing, and `REAL`
is 8 bytes regardless).

| Field | Source | Why it is on the row |
| --- | --- | --- |
| `timestamp` | derived clock, see §4 | required |
| `tws`, `twa` | `MWV,T` | the polar's inputs. `twa` stored **signed ±180°** (positive = starboard, matching `getTwa`) — folding to `CONTEXT.md`'s 0–180° destroys the tack |
| `twd` | `MWD` (true field) | cross-check that catches a mis-parsed TWA; the quantity the Plan tab speaks |
| `stw` | `VHW` | **is** the polar's `speed` |
| `sog`, `cog` | `VTG`/`RMC` | load-bearing, not nice-to-have: with STW+HDG they give the **current vector**, which drives the §6 classification and the tide warning |
| `hdg` | `HDG` + variation | `MWV` measures wind **from the bow**, so TWD = heading ± TWA. Deriving TWD from COG instead is wrong by leeway+set — largest exactly when beating |
| `variation` | `RMC` / `HDG` | makes the magnetic→true conversion auditable and reversible. `NULL` when unavailable, **never a silent 0** |
| `awa`, `aws` | `MWV,R` | the cross-check's input (§6). Columns, not raw-log-only, because `06` may delete the raw log before analysis runs |
| `heel`, `trim` | `XDR` | inputs to two of the three reproducible corrections (`17`). Not corrected with today — stored because that door **cannot be reopened retroactively**, and heel independently feeds `07` and review |
| `lat`, `lon` | `RMC`/`GGA` | without a track on a map, scrubbing to "that beat up the harbour" is guesswork |
| `gpsTime` | `RMC` | nullable; re-anchors a session whose device clock was wrong (§4) |
| `rawOffset` | byte offset | makes the raw log *usable*, not merely retained |

`HDT` is receive-only on this plotter (`01`), so true heading is computed as
magnetic + variation. That is a **datum conversion using a value from the same
wire** — the same class as km/h→knots — not a derivation.

**Storage is a non-argument.** 1 Hz × 3 h ≈ 10,800 rows; ~18 `REAL` columns
≈ 150 B/row ≈ **1.6 MB per race**. The ticket's premise that nice-to-have
fields cost storage forever is true in principle and negligible here — the real
cost of a wide row is ambiguity.

### 3. No derived columns

Modelled quantities — our own true wind, TWA folded to 0–180 + tack, the
current vector — are **pure functions of stored inputs and are computed at
analysis time**. A derived column freezes a formula version into the data: fix
the derivation later and every recorded session is silently wrong until
re-recorded. Unit and datum conversions are the explicit exception (§2).

### 4. Time — anchor once, then advance monotonically

`timestamp = sessionStartWallClock + monotonicElapsedMs`. Absolute epoch ms,
always present, monotonic by construction, and **immune to the Android wall
clock stepping mid-race** on an NTP sync — which would otherwise scramble
ordering and make §5's gap detection lie.

`gpsTime` from `RMC` is stored alongside as a nullable column. It costs one int
and it is the only way to re-anchor a whole session whose device clock was
simply wrong when recording started — otherwise an unrecoverable loss.

### 5. Validation, staleness and gaps

**Validation is v1, at the parse boundary, before any unit conversion.** `14`
found the *genuine* Navico capture is already malformed with no fault injection
— all 142 `$SDVLW` corrupt, `$IIXDR` carrying `-1.-3`, 331/6323 lines over
82 chars. The failure mode is not crashes; it is **plausible wrong numbers
entering polars silently**: `parseFloat('-1.-3')` returns `-1`, not `NaN`; a
`$WIMWV,0.0,T,0.0,N,V` status-`V` sentence reads as a real 0 kn sample; a
TCP-split sentence parses cleanly with every field one slot wrong.

- Checksum, field count, numeric parse, per-field range, status flag.
- **Row-level rejection for anchors, field-level for everything else.** A
  corrupt `$IIXDR` must not cost a wind sample; a row whose *wind* is the
  corrupt part is not a sample of anything.
- Status `V` is a rejection, not a zero.
- **Over-length lines are counted, not rejected** — 5% of a valid real stream
  breaks the 82-char limit, and dropping it discards good data over a spec
  violation nobody enforces.
- **Per-sentence-type reject counters on the session**, surfaced in review.

**Staleness — TTL-null.** A field older than its TTL is written `NULL`, never
repeated. Staleness is *absence of arrival*, not absence of change: `VHW` emits
every second whether or not the number moved, so a constant reading is never
nulled, while `nasty.json`'s 90 s freeze — which would otherwise fabricate 90
rows of boat speed, and boat speed **is** the polar's output — always is. Per-field
stale counters on the session.

**TTL = `max(1 s, 3 × nominal period)`** — 3 s for the 1 Hz fields, a 1 s floor
for 10 Hz `HDG`. Measured, not guessed: reconstructing the 142 seconds of
`logs/gofree-merrimac.log` second-by-second from `RMC` gives

| Sentence | Rate | Seconds present | Longest absence |
| --- | --- | --- | --- |
| `VHW`, `VTG`, `RMC`, `GGA` | 1.00/s | 142/142 (100%) | **0 s** |
| `MWV` (R+T) | 1.99/s | 141/142 (99.3%) | 1 s |
| `MWD` | 0.99/s | 141/142 (99.3%) | 1 s |
| `HDG` | 9.68/s | 142/142 (100%) | 0 s |

— which also confirms `01`'s rate table empirically for the first time (it was
inferred from a 2013-era platform spec). A healthy stream never misses more than
one consecutive second, so both TTLs trip only on genuine failure. The flat
"3× period" rule was rejected because at 10 Hz it means 300 ms, which transport
jitter alone would trip. **Caveat:** the capture is a line dump with no
wall-clock timestamps, so it shows *emission* cadence, not *arrival* timing —
transport jitter is invisible in it and is the reason for the margin.

**Gaps — absent rows plus a session-level connection-event log.** No marker rows:
a marker row is a row that isn't a sample, and it poisons every
`SELECT * FROM sample` for the app's life while every consumer must learn to
skip it. Disconnect/reconnect events live on the session, where review can show
*why* the hole exists. Then one rule in analysis, independent of cause: **any
inter-row delta beyond ~5 s is a hard discontinuity — never smooth, average or
interpolate across it.** Necessary because a dropout and both-anchors-dead look
identical in the data.

### 6. True wind: trust the instrument, cross-check per session

The question was raised here and delegated to `17`, which **inverted this
ticket's working assumption**. `05` proposed deriving water-referenced true wind
ourselves as configuration-free; that premise is false — honest derivation needs
a per-boat leeway coefficient, mast height and upwash table.

- **`MWV,T` is what gets written to polar points.** Unchanged from `01`.
- **The derived value is a per-session classification, not a per-sample column**:
  derive true wind twice (from `VHW`+`HDG`, and from `VTG`/`RMC`) and record
  which one `MWV,T` tracks → `water` / `ground` / `instrument-corrected` /
  `unknown`. Review warns on `ground`. This is the only way to answer `01`'s
  open verify item 7 without a tide table.
- **Never blend derived with instrument values.** Two wind scales in one table
  is the worst available outcome (`17` §5).
- Sessions below ~6 kn TWS carry **low confidence** on wind-shear grounds.

### 7. Units

Knots is **already** canonical in the DB — verified against the code, not
assumed: `convertSpeed(v, from, to = DEFAULT_SPEED_UNIT)` with
`DEFAULT_SPEED_UNIT = 'kn'` (`lib/format.ts:40`), and every write path converts
(`NewSailPolarDialog.tsx:114-116`, `twa-limits.tsx:65-70`,
`TrueWindInputCard.tsx:24`). `speedUnit` is entry/display only. `CONTEXT.md`
said otherwise and has been corrected this session.

Samples therefore store knots and promotion needs no conversion. One gap found:
CSV import (`features/sailPolar/util/sharing.ts:53-65`) is the only writer that
doesn't convert, silently assuming knots — logged out of scope at
[`.tickets/tech-debt/issues/01-csv-import-assumes-knots.md`](../../tech-debt/issues/01-csv-import-assumes-knots.md).

### Verification required before this is called settled

Per `14`'s standing instruction: run the decided rules against
`node nmea-sim.js sail --script scripts/nasty.json` and confirm the 90 s `VHW`
freeze yields 90 rows with `NULL` boat speed and **intact wind**.

### Consequences for other tickets

- **`07` is unblocked** — its measured evidence has been waiting on this.
- **`06` must know sample rows point into the raw log** via `rawOffset`;
  deleting the log dangles them.
- **`08`** takes this field list as the sample table's shape, plus session-level
  columns: wind classification, reject counters, stale counters, connection
  events.
- **`04`** gained 8 verify items from `17`, now recorded on that ticket.
