# 14 — Build the NMEA simulator

Type: task
Status: resolved
Blocked by: —
Map: [map.md](../map.md)

## Question

`12` decided the approach; this ticket builds it. It exists as a ticket because
several later decisions cannot be *made* without it — `07` needs ground truth
to choose a percentile, `10` needs a plausible session to prototype against,
`13` needs three hours of stream, and `11` needs fault injection. It is the
single thing that takes the boat off the critical path.

Per `12`: a **~300-line dependency-free Node TCP server** (`net.createServer`)
in the workspace, sibling to `polars/`. Three modes.

### Mode 1 — replay (do this first; it's the half-day that unblocks the most)

Replay a captured log over TCP at realistic pacing. Seed it with **Signal K's
`samples/gofree-merrimac.log`** — 274 KB off a Navico GoFree gateway, carrying
`$WIMWV` in **both `R` and `T`** forms, `$WIMWD`, `$SDVHW`, `$SDHDG`, `$IIXDR`.
Real B&G-family wind data, available now, no boat required. Later it replays
`04`'s own capture.

Note the sample has **no timestamps**, so pacing is an assumption — see the
timestamp requirement `12` handed to `04`.

### Mode 2 — scripted sail with ground truth

Sail a synthetic course at known TWS/TWA derived from a known polar, emit the
matching sentences, and ship a manifest of the truth. Build as a **sibling
module to `polars/generate-polars.js`, not inside it** — reuse its seeded PRNG,
manifest convention and noise model. ~250–400 lines.

This is what makes `07` decidable rather than guessable: run the pipeline and
check whether it recovers the polar you started from.

### Mode 3 — fault injection

The reason nothing off the shelf will do. Must reproduce:

- mid-stream dropout, and a **dead socket that stays open** (black hole)
- malformed and truncated sentences
- **a sentence split across two TCP writes** — the parser must reassemble
- some fields going stale while others keep updating (hold `VHW` while `MWV`
  flows) — this is what `05`'s staleness question needs
- a tack

### Emit exactly what the Zeus emits

Per `01`: `MWV` with `R` **and** `T` at 1 Hz, `MWD`/`VHW`/`VTG`/`RMC` at 1 Hz,
`HDG` at 10 Hz, no `HDT`, no `VWR`/`VWT`. TCP, port 10110, ~2.3–2.7 kB/s. The
`MWV`-twice case is the most valuable thing it does — it exercises the most
plausible parser bug in the feature.

### Also set up the hotspot rig

`nmcli device wifi hotspot` on the Fedora box (dnsmasq, `10.42.0.1/24`), so the
no-internet-WiFi trap is reproducible and the port can be `nft`-dropped for
black-hole tests. Per `12`, the test phone needs **working mobile data** for the
bug to appear, and must **not** have tapped "stay connected" on the no-internet
prompt.

Resolved when the simulator runs, a phone can connect to it over the hotspot,
and the answer records how to invoke each mode.

## Answer

**Built and passing.** [`nmea-sim/`](../../../nmea-sim/README.md) — zero
dependencies, ~1400 lines across seven files, all three modes working, 14
self-tests green over real sockets. The boat is off the critical path.

### How to invoke it

```
node nmea-sim.js replay                        # real Navico capture over TCP
node nmea-sim.js sail                          # synthetic race at a known polar
node nmea-sim.js sail --script scripts/nasty.json   # + every failure mode
node nmea-sim.js generate --duration 10800     # 3 hours of log in a second
node verify.js logs/race.log                   # score it against ground truth
node test.js                                   # self-test, ~40 s
sudo ./hotspot.sh up                           # this box becomes the plotter's AP
```

`--port` (default 10110), `--script`, `--seed`, `--out`, `--rate`, `--speed`,
`--loop`, `--max-clients`, `--quiet`. Full reference in the README.

### What was built, and the one structural departure from `12`

`12` specified three modes. Fault injection turned out **not** to be a third
mode but a **filter both sources pass through** — "does the parser reassemble a
split sentence?" is just as worth asking of the real GoFree capture as of
synthetic data, so `replay --script scripts/nasty.json` works too. This is
strictly more than `12` asked for and cost nothing.

The other structural note: `12` said not to extend `generate-polars.js` and to
share the fleet instead. Done — the fleet ground truth, seeded PRNG and speed
interpolation moved to **`polars/fleet.js`**, imported by both. The four
existing fixtures regenerate **byte-for-byte identical**, so the sail-suggestion
harness baselines are untouched.

### The finding `07` should act on

`12` challenged founding decision 7 with closed-form arithmetic: a
90th-percentile derivation overstates the polar by ~8.3 %. Running that
end-to-end over a generated lap **confirms the arithmetic and then changes the
answer**, because of one deliberate departure from `generate-polars.js`'s noise
model.

`sampleNoisy` redraws the trim factor for every sample. A real boat stays badly
trimmed for a while, so the simulator **holds** the factor for a dwell
(`trimDwellSec`, default 30 s) drawn from the identical distribution. Marginal
distribution unchanged; autocorrelation now realistic. Over one 50-minute lap,
95 bins with ≥5 samples:

| statistic | held trim (realistic) | i.i.d. (`trimDwellSec: 0`) | `12` predicted |
| --------- | --------------------- | -------------------------- | -------------- |
| mean      | −2.72 %               | −0.99 %                    | —              |
| p50       | −2.86 %               | −0.26 %                    | −0.2 %         |
| p75       | **+0.87 %**           | +2.46 %                    | +2.1 %         |
| p90       | +3.12 %               | +6.83 %                    | +8.3 %         |
| max       | +4.70 %               | +12.12 %                   | —              |

The i.i.d. column reproduces `12`'s closed form, which is what makes the
instrument trustworthy. The realistic column is the one `07` should argue from,
and it says two things: the p90 overstatement is **roughly half** what `12`
feared once trim is autocorrelated, and **p75 is very nearly unbiased**. Note
also that mean and p50 go *negative* under held trim — a bin dominated by one
poor-trim stretch has no good samples to average, which is precisely the case
the steady-state filter exists to remove. `07` now has a number for every
candidate statistic instead of a taste argument. Regenerate with
`node verify.js` after any change to the noise model.

Round-trip accuracy for `05`: reducing `MWV,R` + `VHW` back to true wind
recovers `MWV,T` to **0.106° mean / 0.423° max** and **0.034 kn mean**. That
residual is the 1-decimal-place quantisation in the sentences themselves, which
is real and worth knowing: **the wire costs you a tenth of a degree and a
tenth of a knot before the app does anything at all.**

### Three facts the real capture handed us for free

Seeded with Signal K's `gofree-merrimac.log` (274 KB, real Navico GoFree
gateway, `$WIMWV` in both `R` and `T`) as `12` recommended. Parsing it properly
turned up things no amount of reasoning would have:

1. **All 142 of its `$SDVLW` sentences are malformed** —
   `$SDVLW,$SDVLW,,N,322.0,N,…`, the talker id repeated inside the fields.
2. **Its `$IIXDR` carries `-1.-3`** where a number belongs.
3. **331 of its 6323 lines exceed NMEA's 82-character limit.**

This is a *real plotter's real output*, with no fault injection applied. A
parser that assumes well-formed input is already wrong on data we have in hand.
`05` should treat sentence-level validation as a v1 requirement, not a hardening
pass. (The self-test asserts these stay present, so the file cannot be
silently "cleaned up".)

### Two bugs the self-test caught in the simulator itself

Worth recording because both are bugs the *app* can have too. The split-write
fault originally used a bare `setTimeout` for the second fragment, which
delivered it **after** the sentences that followed — a scrambled stream, not a
split sentence. Fixed with a per-connection write chain. And an `at: 0` fault
never applied to the first tick, because a source's first tick is synchronous
while `setTimeout(0)` is not. An instrument nobody checks is a source of
confident wrong answers; `node test.js` is that check.

### What it does NOT do, and why

- **Throughput is ~1.9 kB/s**, against `01`'s ~2.3–2.7 kB/s estimate for the
  real plotter. The gap is sentences we don't bother emitting (`GSA`, `GSV`,
  depth, the autopilot nav suite, AIS). **`06` must size logs from `01`'s
  figure, not from this one.**
- **Two faults live below the socket** and are `hotspot.sh`'s job, not a
  script's: a true black hole (`nft` drop — no FIN, no RST, minutes before TCP
  notices) and a DHCP address change. The `silence` op is the *app-level*
  version, where TCP is perfectly healthy and only the data stopped. Telling
  those two apart is `11`'s problem and it can now generate both.
- **The pacing of `gofree-merrimac.log` is a guess** — it carries no
  timestamps, so any timing conclusion drawn from replaying it is void. Logs
  this tool writes carry NMEA v4 TAG blocks (`\s:ZEUS,c:<epoch ms>*hh\`) and
  replay at true original wall-clock. `c:` is seconds per the spec; seconds
  cannot express a 10 Hz `HDG`, so we write millis and the reader accepts
  either. **This is the concrete form of the timestamp requirement `12` handed
  to `04` and `06`.**
- **The noise model is still a guess** until `04` measures the real one. But
  the harness is *parameterised* by it, so `04` upgrades it rather than
  invalidating it.

### The hotspot rig

`hotspot.sh up|status|blackhole|restore|down` — `nmcli` shared-mode AP on
`10.42.0.1/24` with dnsmasq, plus `nft` rules for the black hole. Verified
`status` runs; the `up`/`blackhole` paths need `sudo` and a phone, so they are
**untested end to end** — that is the one part of this ticket left for a human
with the test phone in hand. The two conditions from `12` are baked into the
script's own output: the phone needs **working mobile data**, and must not have
tapped "stay connected" on the no-internet prompt for that SSID.

### Unblocks

`13` is now fully unblocked. `07` still waits on `05`. `10` and `11` can now
validate against a plausible session rather than imagining one.
