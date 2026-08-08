# 05 — What is a sample row, and how often do we write one?

Type: grilling
Status: open
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

<!-- filled on resolution -->
