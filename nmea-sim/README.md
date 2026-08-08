# nmea-sim — a B&G Zeus 3 on your desk

Boat access is scarce. This is what keeps it off the critical path.

A dependency-free Node TCP server that speaks the same NMEA 0183 the boat's
Zeus 3 puts on the wire, and misbehaves on demand in every way a plotter and a
phone can misbehave at each other. Built for
[`.tickets/nmea-ingestion`](../.tickets/nmea-ingestion/map.md) ticket `14`,
from the survey in [`research/12`](../.tickets/nmea-ingestion/research/12-nmea-simulator.md).

Nothing off the shelf could do this. The nearest candidate computes true wind
angle wrong, and none of them can hold one field stale while another keeps
updating — which is exactly the question ticket `05` needs answered.

## Usage

```
node nmea-sim.js replay [logfile]     # serve a captured log over TCP
node nmea-sim.js sail                 # sail a scripted course at a known polar
node nmea-sim.js generate             # write a log + ground truth, no socket
node verify.js logs/race.log          # score a generated log against its truth
node test.js                          # self-test (~40s)

Options
  --port N          listen port (default 10110, the Zeus's own)
  --host ADDR       bind address (default 0.0.0.0)
  --script FILE     course + fault timeline (default scripts/race.json)
  --seed N          PRNG seed; a script's own `seed` wins
  --out FILE        also write a timestamped, replayable log
  --duration SEC    generate: how much to produce (default: one lap)
  --rate N          replay: sentences/sec for logs with no timestamps
  --speed N         replay: playback multiplier for logs that have them
  --loop            replay: start over at the end
  --max-clients N   refuse beyond N connections (the Zeus's own limit is
                    UNCONFIRMED — ticket `01` flagged it)
  --quiet
```

## The three modes

### 1. Replay — real Navico data, available today

```
node nmea-sim.js replay
```

Serves [`logs/gofree-merrimac.log`](logs/): 274 KB recorded off a Navico
**GoFree** gateway, the same family as the boat's Zeus 3, shipped in Signal K's
samples. It carries `$WIMWV` in **both `R` and `T`** forms plus `$WIMWD`,
`$SDVHW`, `$SDHDG`, `$IIXDR` — real B&G-family wind and boat-speed output,
before ticket `04` ever gets on the water.

Two things to know about it:

- **It has no timestamps.** Pacing is therefore a guess (`--rate`), and *any*
  timing conclusion drawn from replaying this file is worth nothing. This is
  precisely the gap ticket `12` handed to `04` and `06`: the boat capture must
  carry per-sentence timestamps. Logs this tool writes (`--out`, `generate`) do,
  as NMEA v4 TAG blocks, and replay at true original wall-clock.
- **It is already dirty.** All 142 of its `$SDVLW` sentences are malformed
  (`$SDVLW,$SDVLW,,N,322.0,N,…` — the talker id repeated inside the fields),
  its `$IIXDR` carries `-1.-3` where a number belongs, and 331 of its 6323
  lines exceed NMEA's 82-character limit. That is a **real** plotter's real
  output. A parser that assumes well-formed input is already wrong, and this
  file proves it without any fault injection at all.

### 2. Sail — a known polar, and the truth to check against

```
node nmea-sim.js sail                        # serve it live
node nmea-sim.js generate --duration 10800   # or write 3 hours in a second
node verify.js logs/race.log
```

Sails a scripted course at the polar in [`../polars/fleet.js`](../polars/fleet.js)
— the same ground truth the sail-suggestion accuracy harness scores against —
and writes a manifest saying what the answer was supposed to be.

This is what makes ticket `07` decidable rather than guessable. Replaying a
real race can never quantify the bias in "take a high percentile of a noisy
bin", because nobody knows what the boat's true polar was that day. Here you
do, so the question becomes arithmetic.

The manifest holds:

- `truth` — one row per second: the true TWD/TWS/TWA/tack, the sail, the
  boat's true polar speed, what it actually did, and whether it was
  **manoeuvring** (a tack or gybe is not a polar point).
- `grid` — that reduced to the same **1 kn TWS × 4° TWA** bins the app's
  `buildClusteredPolarGrid` uses, over steady-state samples only. A derivation
  that recovers `grid.trueSpeed` is correct; one that does not is measuring
  instrument noise.

The stream carries **apparent** wind (`MWV,R`) derived by vector addition
alongside the **true** wind (`MWV,T`) the Zeus emits directly, so the app's
true-wind trig can be round-tripped end to end. That is ticket `05` question 2,
and `verify.js` scores it.

#### Writing a course

`scripts/race.json` is the worked example. A leg is a heading, a duration and a
sail; a heading change that crosses the wind is a tack or gybe, and the
simulator ramps the heading over ~10 s, collapses boat speed to 40 %, and takes
another ~15 s to recover — flagging every sample of it `manoeuvring: true`.
That is the signal ticket `07`'s steady-state filter exists to reject.

Pick headings so each leg's TWA lands inside its sail's band, and cover **both
tacks** — a sign error in the app's TWA/tack derivation cannot hide in a
one-tack course.

#### One deliberate departure from `generate-polars.js`

The speed noise uses the identical distribution to `sampleNoisy` (20 % poor
trim `U(0.82,0.92)`, 65 % on target `U(0.97,1.03)`, 15 % surfing
`U(1.05,1.15)`), but the factor is **held for a dwell** (`trimDwellSec`,
default 30 s) rather than redrawn every sample. A real boat stays badly trimmed
for a while, and a steady-state filter tested only against i.i.d. noise is
being tested against a fiction.

It changes the answer, which is the point of measuring. Over one 50-minute lap
(95 bins, ≥5 samples each):

| statistic | held trim (realistic) | i.i.d. (`trimDwellSec: 0`) |
| --------- | --------------------- | -------------------------- |
| mean      | −2.72 %               | −0.99 %                    |
| p50       | −2.86 %               | −0.26 %                    |
| p75       | **+0.87 %**           | +2.46 %                    |
| p90       | +3.12 %               | +6.83 %                    |
| max       | +4.70 %               | +12.12 %                   |

The i.i.d. column reproduces research/12's closed-form arithmetic (it predicted
−0.2 % / +2.1 % / +8.3 %), which is what says the instrument is measuring what
it claims. The other column is the one ticket `07` should argue from.

### 3. Faults — the reason we built rather than adopted

Fault injection is not a third mode; it is a **filter both sources pass
through**, because "does the parser reassemble a split sentence?" is just as
worth asking of a real capture as of a synthetic one.

```
node nmea-sim.js sail --script scripts/nasty.json
node nmea-sim.js replay --script scripts/nasty.json   # faults over real data
```

[`scripts/nasty.json`](scripts/nasty.json) is a ~25-minute timeline of every
failure mode in research/12's table, with a note on each saying which ticket
needs it. The ops:

| `do:` | what it does | why it matters |
| --- | --- | --- |
| `split` | one sentence, two TCP writes | **the most valuable one here.** TCP is a byte stream; a parser assuming one read = one sentence passes everything else and fails on the water |
| `concat` | two sentences, one write | the mirror image |
| `stale` | named sentences stop, the rest keep flowing | ticket `05` q4. **No off-the-shelf tool can do this.** A sample built from a stale `VHW` and a fresh `MWV` is a lie |
| `empty` | emits the status-`V` "I have no data" form | must not become 0 kn from dead ahead |
| `rate` | drops a sentence to 1-in-N | does "complete enough set" logic stall? |
| `corrupt` | wrong checksum | must be dropped, not parsed |
| `truncate` | cut off mid-sentence, no terminator | the next `$` must not read as a continuation |
| `garbage` | binary junk mid-stream | plotters emit this on power-up |
| `silence` | socket open and healthy, no bytes | **app-level** staleness — ticket `05` q4, `11` q5 |
| `dropSocket` | FIN, or RST with `"reset": true` | the easy failure: the app gets a close event |
| `reboot` | drops every client, closes the port, returns after N s | ticket `11` q4 — from the phone this starts out identical to "the phone left the boat" |

Ops take `at` (seconds from connect) and, where it makes sense, `forSec` to
revert themselves. The same script is a reproducible regression test, so
tickets `05`, `07`, `10` and `11` can be argued from evidence.

Two faults live **below** the socket and are not in this table —
[`hotspot.sh`](hotspot.sh) does them.

## The hotspot rig

```
sudo ./hotspot.sh up          # this box becomes the plotter's AP, 10.42.0.1
sudo ./hotspot.sh blackhole   # peer vanishes: packets dropped, no RST
sudo ./hotspot.sh restore
sudo ./hotspot.sh down
```

Reproduces the **no-internet WiFi trap**: the Zeus is an access point with no
internet behind it, Android validates the network, finds none, and — if the
phone has working mobile data — keeps routing through mobile, so the socket to
the plotter never connects. Ticket `02` established the fix
(`interface: 'wifi'`); this is how you see the bug first and prove the fix
after.

Two conditions, or the reproduction is not faithful:

1. the test phone must have **working mobile data** — without it Android has
   nowhere else to route and the bug hides;
2. the phone must **not** have tapped "stay connected" on the no-internet
   prompt for this SSID. That choice is sticky; forget the network to reset it.

`blackhole` is the other sub-socket fault: `nft` drops the port silently, so
there is no FIN and no RST and the phone notices only after TCP retransmit
timeout — minutes — or after an app-level heartbeat. Distinct from the
`silence` op, where TCP is healthy and only the data stopped. Telling those two
apart is ticket `11`'s problem, and this is how you generate both.

## What it emits

Per ticket [`01`](../.tickets/nmea-ingestion/research/01-zeus-3-nmea-output.md):

| Sentence | Rate | Note |
| --- | --- | --- |
| `$WIMWV,…,R,…` | 1 Hz | apparent wind |
| `$WIMWV,…,T,…` | 1 Hz | **true wind, emitted directly** — the Zeus does the derivation |
| `$WIMWD` | 1 Hz | TWD + TWS, compass-referenced |
| `$SDVHW` | 1 Hz | speed through water |
| `$SDHDG` | **10 Hz** | magnetic heading + variation |
| `$GPVTG` `$GPRMC` `$GPZDA` `$IIXDR` | 1 Hz | SOG/COG, time/position, heel |
| `$GPGGA` `$GPGLL` | 5 Hz | position |

No `HDT` — the Zeus receives it but never transmits it, so true heading must be
reconstructed from `HDG` plus variation. No `VWR`/`VWT` — deprecated, and this
platform does not emit them. Variation is a non-zero 21.5° E on purpose, so a
magnetic/true mix-up in the app shows up as 21°, not as rounding.

**`MWV` appears twice a second, same talker, same formatter, differing only in
field 2.** A parser that branches on sentence type instead of that field will
silently mix apparent and true wind. It is the most plausible bug in the whole
feature, and it is in range on every single run.

Throughput is ~1.9 kB/s against ticket `01`'s ~2.3–2.7 kB/s estimate for the
real plotter; the difference is the sentences we do not bother emitting (`GSA`,
`GSV`, depth, the autopilot nav suite, AIS). Log sizing conclusions for ticket
`06` should use the real figure, not this one.

## Layout

```
nmea-sim.js        CLI: replay | sail | generate
verify.js          scores a generated log against its ground truth
test.js            self-test — 14 cases over real sockets
hotspot.sh         the AP rig and the sub-socket faults (needs sudo)
lib/sentences.js   sentence construction + TAG-block log lines
lib/server.js      TCP server and the fault layer
lib/timeline.js    scheduled fault ops
lib/replay.js      mode 1
lib/sail.js        mode 2 — physics, dead reckoning, ground truth
scripts/race.json  a clean windward-leeward lap
scripts/nasty.json every failure mode, on a timeline
logs/              the GoFree capture; generated logs are gitignored
```

Zero dependencies, stdlib only, on purpose: this runs on a laptop hosting a
WiFi hotspot with no internet. The boat's true polar lives in
[`../polars/fleet.js`](../polars/fleet.js), shared with the sail-suggestion
fixture generator so the two can never disagree about what the boat can do.
