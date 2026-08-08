# 14 — Build the NMEA simulator

Type: task
Status: open
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

<!-- filled on resolution -->
