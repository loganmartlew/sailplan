# 21 — Race-day capture: the on-water half of `04`

Type: task
Status: open
Blocked by: 04
Map: [map.md](../map.md)

## Question

Capture a **real race** — Saturday — and answer the three things a dock cannot.

Split out of [`04`](04-capture-raw-sample-on-boat.md), which is now the 30-minute
dockside go/no-go visit. `04` answers "can I build against this wire?"; this
ticket answers "is what I built any good, and is the boat's wind system
trustworthy?"

**The shape of the day is the point.** There is a **~1 hour motor to the start
and ~1 hour back**, plus the race. That is far more instrumented time than the
dock offers, and it is *calm* time — nobody is racing during the motor out. The
slow, fiddly items live there; the race supplies the sailing data.

## What only this ticket can answer

1. **`01` item 7 — is `MWV,T` water- or ground-referenced?** Ground-referenced
   true wind bakes tidal current into every polar built in a tideway. The
   discriminator is way on through known tide.
2. **`17` item 7 (⭐) — the tack-to-tack calibration split.** Two tacks in steady
   breeze, comparing `MWV,T` TWD on each. **This is the single highest-leverage
   measurement available all day**: it collapses the calibration state of the
   entire wind system into one number — 3° well calibrated, 5–7° first-pass,
   10° uncalibrated. `17` established that upwash alone is worth 3–5° of TWA per
   tack, a full 4° bin, so this sizes every TWA error on the map for *this*
   boat.
3. **`01` item 6, the liveness half — is the paddlewheel alive?** Answered
   within a minute of the motor starting: `VHW` should track the motoring speed.
   If it reads zero under power, boat speed through water is unavailable and
   polars would have to be built on SOG — a materially worse, tide-contaminated
   feature.

## The plan for the day

### Motor out (~1 hour) — the unhurried set

The moment the engine is on and the boat is moving, item 3 above resolves.
Then, with time to spare:

- **`01` item 12 — plotter in Client mode.** Put the plotter on the phone's
  hotspot instead of using it as the AP. If it works, the phone keeps mobile
  data during the race, which is strictly better than `11`'s current
  assumption. Deferred from `04` because it is a menu change with real risk of
  leaving the plotter misconfigured — here there is time to put it back.
- **`01` item 5 — `MWD` vs `MWV,T` cross-check.** Readable at the dock but only
  meaningful with way on. Disagreement says something real about which
  reference frame is in use.
- **`01` item 11 — multicast GoFree discovery on `239.2.1.1:2052`.** Moved here
  from `04` for a tooling reason, not a time one: Android drops multicast unless
  an app holds a `MulticastLock`, which Termux cannot acquire, so a dockside
  negative would have been uninterpretable. The app's own discovery code *can*
  hold one — so if the app has a discovery path by Saturday, watching it find
  (or fail to find) the plotter **is** the test. If it does not, this stays open
  and manual mode carries the feature, exactly as `11` designed.
- Anything `04` ran out of clock for.
- **Confirm the recording is actually running and rows/bytes are accumulating.**
  Do not discover at the finish that it died at the dock.

### Pre-start — the ⭐ measurement, deliberately

**Do not leave the tack-to-tack pair to chance during the race.** In the
warm-up, in the steadiest breeze available, sail a tack, settle, sail the
other, settle. Note the wall-clock time so the pair can be found in the log.
Five minutes, and it is worth more to the map than the rest of the day.

### The race — just record

Nothing to do but sail. This is the sailing data every downstream ticket was
designed against a simulator for: `07`'s steady-state stretches, `10`'s leg
detection on |TWA|, `19`'s stamp attribution.

If in-race sail stamping exists by Saturday, use it. If not, **write sail
changes and rough times on paper** — `10` decided review is per course leg with
editable spans, so reconstructing attribution afterwards is a supported path,
not a workaround.

### Motor back (~1 hour) — verify before the data is gone

- **Confirm the log survived**: non-empty, timestamped, covers the whole race
  with no unexplained gap. `11`'s auto-end-after-five-minutes rule means a long
  dropout ends the recording silently — check for that specifically.
- If the primary capture failed, **re-dump now** while still on the water. An
  hour of motoring data is far better than nothing, and it still answers items
  1 and 3.
- Note the actual conditions — wind strength and direction, sea state, tide
  state and direction. Without these the sentence values cannot be
  sanity-checked against reality, and a calibration problem is invisible.

## The fallback, and why it matters more than usual

Whatever gets built this week will be running for the first time, on real
hardware, on a boat, in a race. `13` (the device spike) is unresolved, so
founding decision 6 — the foreground service surviving screen-off — still rests
on inference.

**Carry a second, independent capture.** A third-party Android TCP-logging app,
or Termux running `nc`, writing to a file. It costs nothing, it means a failed
foreground service is not a lost race, and it gives a known-good stream to
diff the app's own output against — which is better evidence than either alone.

Per founding decision 2 and `05`, **the raw log is lossless**: sample rows are
derived from the sentence stream, so a raw capture alone preserves the entire
race. Parsing, leg detection, promotion and everything else can be built the
following week and replayed against the file. Nothing is lost but live stamps.

## What this unblocks

**`16` (blend weight and coverage radius)** moves its dependency here from
`04`. `16` needs "a real capture with real instrument noise against a real
imported table for the same boat" — dockside data cannot supply that, because
there is no boat speed and no sailing. A race can.

Note that `16` wants *captured polar points*, not just raw sentences, so it
stays blocked until the race data has been through the `07`/`10` pipeline.

## Resolution

Resolved when the race capture is committed alongside `04`'s and the answer
records:

- **the tack-to-tack TWD split, in degrees** — and what calibration band it
  puts the boat in
- water- or ground-referenced `MWV,T`, and the tide evidence for the call
- whether `VHW` tracked boat speed under power
- whether Client mode worked
- the conditions, so values can be sanity-checked
- whether the app's own capture survived the race, and how it compared to the
  fallback capture — this is `13`'s first real regression test
- any revision forced on `05`, `06`, `07`, `10` or `11`

## Answer

<!-- filled on resolution -->
