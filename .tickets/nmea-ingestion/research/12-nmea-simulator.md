# Research — 12: Simulating NMEA at home

Research for [`issues/12-nmea-simulator.md`](../issues/12-nmea-simulator.md).
Every factual claim below has a source in [Sources](#sources); where a claim
could not be verified it is marked **UNCONFIRMED**.

---

## Recommendation (lead)

**Write our own ~300-line Node TCP simulator in this repo, and use two
off-the-shelf things beside it as reality checks.**

1. **Build `tools/nmea-sim/` (Node, zero dependencies).** A `net.createServer`
   that paces sentences onto the socket. It gets three modes: **replay** a
   captured file, **sail** a scripted synthetic course, and **misbehave**
   (fault injection). This is the only option that can do questions 3 and 4 at
   all — no surveyed tool can hold one field stale while another keeps
   updating, or emit a truncated sentence on purpose, or half-close a socket.
   Node's `net` module is in the standard library, so cost is coding time only.
2. **Start today against a real Navico capture.** Signal K server ships
   [`samples/gofree-merrimac.log`](https://github.com/SignalK/signalk-server/blob/master/samples/gofree-merrimac.log)
   — 274 KB of NMEA 0183 recorded off a Navico **GoFree** gateway, the same
   family as the B&G Zeus 3. Verified sentence census: `$SDHDG` ×1375,
   `$SDVLW` ×1136, **`$WIMWV` ×282** (both `R` and `T` reference),
   `$SDVHW` ×142, **`$WIMWD` ×141**, `$IIXDR` ×141, plus the usual GPS set.
   That is *real B&G-family wind and boat-speed output* available before ticket
   `04` ever happens. Point the replay mode at it and ticket `05`'s parser work
   can begin immediately.
3. **Keep one GUI simulator installed for hand-driving manoeuvres and for
   cross-checking our parser.** Either **NMEASimulator** (panaaj — ships an
   `.rpm` and an AppImage, has a TCP-server mode, emits `$WIMWV` R+T and
   `$WIMWD`) or **OpenCPN + the ShipDriver plugin** (ShipDriver generates
   MWV/MWD/VHW into OpenCPN's multiplexer; OpenCPN re-serves as a TCP server
   when the connection address is `0.0.0.0`). Use these to sanity-check that
   our own generator's sentences are accepted by a real chartplotter-grade
   parser — not as the primary rig, because neither is scriptable.

**Yes, it can emit wind data.** MWV (apparent *and* true), MWD and VHW are all
confirmed available from more than one route — the GoFree sample log, ShipDriver,
and NMEASimulator.

**Yes, the ground-truth synthetic track is worth building.** Details in
[Question 3](#question-3--synthesising-a-track-with-known-ground-truth); the
short version is that ticket `07`'s "high percentile, not mean" decision has a
*quantifiable* bias that cannot be measured any other way, and the existing
`polars/generate-polars.js` already supplies both the ground-truth format and
the noise model, so the marginal cost is roughly a day.

**The hotspot reproduction of the no-internet WiFi trap is faithful**, with two
conditions on the test setup — see
[Question 5](#question-5--the-no-internet-wifi-trap).

Total setup cost: **~1 day** for the simulator base + replay + fault injection,
**~1 further day** for the polar-backwards track generator, **~1 hour** for the
network rig.

---

## Comparison table

| Tool | TCP? | Wind sentences? | Scriptable? | Linux/Fedora? | Maintained? |
|---|---|---|---|---|---|
| **Own Node simulator** (recommended) | Yes — `net.createServer` | Whatever we emit | Fully | Yes | Ours |
| **Signal K server** (`filestream` + NMEA0183 TCP out) | Yes — TCP 10110 | Whatever is in the file; the shipped GoFree sample has MWV+MWD | Config-file + plugins; not a track model | Yes (Node) | **Very** — pushed 2026-08-07, 421★ |
| **OpenCPN + ShipDriver plugin** | Yes — OpenCPN TCP server on `0.0.0.0`, but **one client only** | **Yes** — `WIMWV` (apparent), `WIMWD`, `VHW` in source | No — GUI only | Yes | Yes (both actively developed) |
| **OpenCPN + VDR plugin** (replay) | Same as above | Whatever is in the recording | No — GUI | Yes | Yes |
| **NMEASimulator** (panaaj) | **Yes** — explicit "TCP Server" checkbox | **Yes** — `$WIMWV` R and T, `$WIMWD` observed | No — GUI, closed source | Yes — `.rpm` + AppImage | Stale: last release v1.6.1, 2023-11-10 |
| **kplex** | Yes — TCP client *or* server | N/A — **does not generate anything** | Config file | Yes (its home platform) | Low — last push 2024-02-25 |
| **captv89/nmea-simulator** (Go) | Yes — TCP 10110 | **Yes** — MWV listed, plus VHW | CLI flags only (host/port/interval) | Yes (Go) | Marginal — 1★, last push 2025-05-05 |
| **Kafkar/NMEA_Simulator** (Python) | Yes — TCP server, multi-client | **No MWV/MWD.** VHW + DBT + GPS only | CLI + GPX tracks | Yes | Marginal — 3★, 3 commits |
| **luk-kop/nmea-gps-emulator** | Yes — TCP server mode | **No** — GPS only, no wind in repo | CLI | Yes | Yes — pushed 2026-07-22, 51★ |
| **ggsimulator** (npm) | Yes — TCP dispatch | **No** — GPRMC + AIVDM (AIS) only | Node API + CLI, GPX input | Yes | No — last publish 2022-06-18 |
| **AvNav** | Yes (TCP/UDP outputs) | Handles wind data as a *consumer* | Config | Yes | Yes | 
| **Kave Oy "NMEA Simulator"** | Not documented | Not documented | No | **No — Windows only** (needs com0com virtual serial driver) | — |
| **npm `nmea-simulator` / `nmeasimulator`** | — | — | — | — | **These packages do not exist** on the npm registry |

Notes on the two "N/A"s: **kplex** is a multiplexer, not a generator — it can
serve a file over TCP but has no pacing (see Q1), so it can only blast a log at
line speed. **AvNav** is a chartplotter server; its wind handling is on the
consuming side, and no documented built-in NMEA *generator* was found —
**UNCONFIRMED** whether it has a test/dummy source.

---

## Question 1 — survey of existing tools

### OpenCPN

OpenCPN itself has **no built-in NMEA simulator data source**. The manual's
Connections page documents serial / network / signalk sources with no simulated
option, and the manual's own "NMEA software" page points readers at *external*
simulators instead. A code search of `OpenCPN/OpenCPN` for simulator-generator
code found nothing resembling a sentence generator (only `mwv.cpp`/`mwv.hpp`
*parsers*). Simulation in the OpenCPN world comes from plugins.

What OpenCPN *does* give us is a TCP server and a reference parser:

> "If 0.0.0.0 is entered in the Address box, OpenCPN will act as a TCP server,
> accepting a connection from a remote TCP client. OpenCPN will listen on all
> its host computer's network interfaces for TCP connections to the port
> specified in the DataPort field."

with the important caveat:

> "In the current implementation, a single data connection can accept only one
> client."

Port 10110 is the IETF-assigned port for NMEA 0183 over TCP/UDP.

**ShipDriver plugin** — "intended as a very basic ship simulator", available for
Windows, Linux and macOS. Confirmed by reading
`src/shipdriver_gui_impl.cpp` directly: it builds and pushes wind sentences into
OpenCPN's multiplexer —

```
864:    MWVA = createMWVASentence(initSpd, myDir, wdir, wspd);
865:    MWD  = createMWDSentence(wdir, wspd);
867:    PushNMEABuffer(MWVA + "\r\n");
868:    PushNMEABuffer(MWD  + "\r\n");
...
878:    PushNMEABuffer(GLL + "\r\n");
879:    PushNMEABuffer(VTG + "\r\n");
880:    PushNMEABuffer(VHW + "\r\n");
881:    PushNMEABuffer(RMC + "\r\n");
882:    PushNMEABuffer(HDT + "\r\n");
883:    PushNMEABuffer(MDBT + "\r\n");
```

Talker ID is `WI`. There is also a `createMWVTSentence` (true-wind MWV) in the
source. So: **OpenCPN + ShipDriver = a GUI sailing simulator with real wind
sentences, re-served over TCP.** Not scriptable, single TCP client.

**VDR plugin** — Voyage Data Recorder. Records raw NMEA (or CSV with
timestamps) from all ports and replays it into OpenCPN's bus; "1x sentences /
messages are replayed at exactly the same original clock, i.e. real time", with
2x…100x speed-up available. Combined with the `0.0.0.0` TCP-server connection,
this is a working GUI-driven replay-over-TCP rig — the off-the-shelf answer to
question 2 if we don't want to write anything.

### kplex

Genuinely good software, wrong shape for this job. From the README: kplex is
"a multiplexer for various nmea 0183 interfaces" for "Linux, OS X and FreeBSD",
and "kplex can act either as a tcp server (allowing other programs on the same
or other machines to connect to it)". It **does not generate NMEA** — it routes
sentences it is given.

It *can* take a file as an input interface, but I read `fileio.c` directly: the
file interface's only options are `filename`, `qsize`, `append`, `owner`,
`group`, `perm`. **There is no delay/throttle/pacing option**, so
`kplex file:filename=race.log → tcp server` would dump the entire log at line
speed in a fraction of a second. Useless as a replayer without an external
pacer.

One genuinely relevant find: kplex contains `gofree.c`, an implementation of
**Navico GoFree discovery** — multicast group `239.2.1.1`, UDP port `2052`:

```c
#define GOFREE_PORT 2052
#define GOFREE_GROUP "239.2.1.1"
```

That is the discovery mechanism a B&G Zeus 3 announces itself on, and it is
directly useful to tickets `01` and `11`. If `11` goes the auto-discovery route,
kplex's `gofree.c` is a free reference implementation, and our simulator can
imitate those announcements.

### Signal K server

The strongest *maintained* off-the-shelf option (421★, pushed 2026-08-07). It
has all three pieces:

- **File input.** `packages/streams/src/filestream.ts` — a `FileStream` provider
  taking `{ filename, keepRunning }`; `keepRunning` defaults to true and loops
  the file (`this.filestream.on('end', () => this.startStream())`). Docs:
  "Sample files are available which can be set up as input for the server."
- **Pacing.** Two throttles exist. `packages/streams/src/throttle.ts` re-exports
  `stream-throttle` (byte-rate). `packages/streams/src/timestamp-throttle.ts` is
  the real prize — it reads a timestamp off each message
  (`'YYYY-MM-DD-HH:mm:ss.SSS'` by default) and `setTimeout`s each push to
  `msgMillis - Date.now() + offsetMillis`, i.e. **replay at original wall-clock
  timing**.
- **TCP output.** "All incoming NMEA0183 data is made available over TCP on port
  10110 by default." The NMEA0183 server guide confirms "NMEA 0183 over TCP
  (10110)".

And the sample data. `samples/` contains `gofree-merrimac.log` (274 KB),
`plaka.log` (3.0 MB), `gps.log`, `aava-n2k.data`, and three AIS logs. I ran a
sentence census over `gofree-merrimac.log`:

```
1375 $SDHDG   1136 $SDVLW    426 $GPGSV    282 $WIMWV
 142 $SDVHW    142 $SDMTW    142 $SDDPT    142 $SDDBT
 142 $GPZDA    142 $GPVTG    142 $GPRMC    142 $GPGGA
 141 $WIMWD    141 $IIXDR     90 $GPBWC     90 $GPBWR   (+ others)
```

with lines like:

```
$WIMWV,297.6,R,5.6,N,A*2A
$WIMWV,297.5,T,5.6,N,A*2F
```

i.e. apparent and true wind, alternating, from a Navico GoFree gateway. Note
the log is a **raw sentence dump with no timestamps**, so `timestamp-throttle`
does not apply to it — byte-rate throttling or our own fixed pacing is needed.

Downside: a full Signal K server is a heavy dependency to stand up just to serve
a file, it normalises everything through the Signal K data model, and it cannot
inject the faults question 4 needs.

### NMEASimulator (panaaj)

The AppImage/`.rpm` GUI simulator. README: "NMEA / Signal K data stream
generator to mimic vessel movement, engine status, water depth, etc.",
"Available for: Windows, Mac, Linux and Raspberry Pi". Three modes: seed values
+ periodic delta, follow a GPX/KML track, and **replay a recorded log**.

TCP is confirmed by the maintainer in issue #3:

> "When the TCP Server option is checked NMEASimulator acts as a TCP server
> transmitting a stream for clients to consume. If you telnet to the configured
> ip address:port you should see the stream of NMEA data. When the TCP Client
> option is checked NMEASimulator acts as a TCP client…"

Wind sentences are confirmed by issue #28, which quotes actual output:

```
$WIMWV,75.7,T,13.2,N,A*20
$WIMWD,75.7,T,75.7,M,13.2,N,6.8,M*64
$WIMWV,42.0,R,16.3,N,A*21
```

**But read issue #28's actual complaint, because it matters to us:**

> "It looks like TWA is send the same as Wind Direction in case True Wind
> Direction is less than 180 degrees… There is no influence of COG of the boat
> (COG should be subtracted somehow I believe). So the correct TWA is displayed
> if Boat is heading to the North only."

The true-wind MWV does not account for heading. The issue is closed but there
has been no release since 2023-11-10, so **assume it is still broken**. A
simulator whose TWA is wrong except when heading north is disqualifying for a
polar ground-truth test, and is exactly why we shouldn't build the derivation
harness on it. Also: closed source (open issues "Is the source code
available?", "Possible open sourcing so community can extend?"), GUI-only, and
an open bug "Settings are reset after restart of application".

Fine as a smoke-test peer. Not fine as the foundation.

### captv89/nmea-simulator (Go)

Closest off-the-shelf match to the brief. README: TCP server on "default port
10110" for NMEA 0183 (and 10200 for NMEA 2000), plus WebSocket servers.
Environment sentences listed: "DBT (Depth Below Transducer), MTW (Water
Temperature), **MWV (Wind)**, VHW (Water Speed & Heading), DPT (Depth)", plus
GGA/GLL/RMC/VTG/HDT. CLI flags for protocol, port, host, baud, and data update
interval. MIT, Go 1.24+.

Caveats: 1 star, 18 commits, last push 2025-05-05, and no vessel/track model —
it generates plausible values, not a boat sailing a course. It cannot express
"hold this TWA at this TWS for four minutes then tack".

### Kafkar/NMEA_Simulator (Python)

TCP server, multi-client, stdlib-only Python 3.6+, GPX track input, CLI
options. **But: no wind sentences.** It emits GPRMC/GPGGA/GPGSV, VHW and DBT.
VHW alone (heading + speed through water) is useful but not sufficient. 3★,
3 commits.

### luk-kop/nmea-gps-emulator

Actively maintained (pushed 2026-07-22, 51★), has a "NMEA TCP Server mode", but
it is what it says: a **GPS receiver emulator**. A code search across the repo
for `MWV` returned nothing and for `wind` returned only Windows-platform
strings. **No wind. Useless here.**

### npm `nmea-simulator` packages

The ticket lists "the various `nmea-simulator` npm packages". I queried the npm
registry directly: **`nmea-simulator`, `nmeasimulator` and `nmea-sim` do not
exist**. The nearest thing is **`ggsimulator`** (GeoGate), which does have TCP
dispatch and GPX track input — but the encoder "formats outgoing messages to
GPRMC/AIVDM standard", i.e. **GPS and AIS only, no wind**, and it was last
published 2022-06-18. The rest of the npm NMEA ecosystem (`nmea-simple`,
`node-nmea`, `@drivetech/node-nmea`) are *parsers*, not generators.

### Kave Oy "NMEA Simulator"

Listed in OpenCPN's manual. The vendor page requires "The virtual serial port
driver for Windows" and com0com — **Windows only**. Out.

### AvNav

AvNav (wellenvogel) is a chartplotter/server that consumes NMEA, forwards it,
and "can configure additional outputs via TCP and UDP". It parses wind fields.
I found **no documented built-in simulator or dummy data source** —
**UNCONFIRMED**; I would not plan around it.

### The wind sentences themselves

For whatever we build, from the NMEA reference:

| Sentence | Layout | Note |
|---|---|---|
| `MWV` | `$--MWV,x.x,a,x.x,a,a*hh` — angle 0–359, reference `R`(elative)/`T`(rue), speed, units `K/M/N`, status `A`/`V` | **This is the one to use.** Both apparent and true are expressed with the same sentence, distinguished by field 2. |
| `MWD` | `$--MWD,x.x,T,x.x,M,x.x,N,x.x,M*hh` — true wind *direction* (TWD) + speed | Gives TWD directly. |
| `VHW` | `$--VHW,x.x,T,x.x,M,x.x,N,x.x,K*hh` — heading true/magnetic + speed through water | Boat speed for polars. |
| `VWR`/`VWT` | relative / true wind, angle 0–180 + L/R | **Obsolete.** The NMEA standard committee's obsolete-sentence list includes VWT; "the use of MWV is recommended". Support them defensively on the parse side (SeaTalk converters still emit them) but do not generate them as the primary. |

Supporting: `RMC` (time, position, SOG, COG), `VTG` (COG/SOG), `GGA`
(position/fix), `HDG`/`HDT` (heading), `DPT`/`DBT` (depth). The GoFree sample
also carries `VLW` (log distance) and `XDR` (transducer) heavily — worth
expecting from the Zeus 3.

---

## Question 2 — replaying a real capture over TCP

**Confirmed trivial. Nothing more than a file and ~40 lines is needed**, and
there are two zero-code fallbacks.

The whole of it in Node:

```js
const net = require('net');
const lines = require('fs').readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
net.createServer(sock => {
  let i = 0;
  (function tick() {
    if (i >= lines.length) return sock.end();
    const [ts, sentence] = splitTimestamp(lines[i++]);   // see below
    sock.write(sentence + '\r\n');
    setTimeout(tick, delayUntil(ts));
  })();
}).listen(10110);
```

Zero-code fallbacks, in increasing fidelity:

- `socat TCP-LISTEN:10110,reuseaddr,fork SYSTEM:'while read l; do echo "$l"; sleep 0.1; done < race.log'` — crude fixed pacing, good enough to prove a socket works.
- **Signal K server** with a `filestream` provider + `throttle`, output on TCP
  10110 — and its `timestamp-throttle` replays at exact original wall-clock if
  the log carries timestamps.
- **OpenCPN + VDR plugin**, replaying at "exactly the same original clock" into
  a `0.0.0.0` TCP-server connection.

**The one thing to decide now, because it constrains ticket `04` and `06`:
the raw log must carry per-sentence timestamps.** A bare sentence dump (like
`gofree-merrimac.log`) can only be replayed at a guessed fixed rate, which
destroys exactly the timing information tickets `05` (rate, staleness) and `11`
(gap detection) need to be tested against. Two options, both standard:

- Prefix each line with epoch millis: `1735689600123 $WIMWV,42.0,R,16.3,N,A*21`.
  Simplest; requires stripping on replay.
- Use an **NMEA 0183 v4 TAG block**: `\s:ZEUS,c:1735689600*hh\$WIMWV,...`.
  Standards-compliant and Signal K already understands it — its docs note
  "NMEA0183 data may include timestamps in tag blocks… when playing back
  captured data you may want to ignore the data and override them with current
  time". A TAG-block log is replayable by third-party tools with no
  preprocessing.

Recommend the TAG block, falling back to the epoch prefix if the Zeus's own
sentences ever collide with it. Feed this back into ticket `06`.

---

## Question 3 — synthesising a track with known ground truth

**Verdict: build it. It is not overkill, and `polars/generate-polars.js` is
two-thirds of the way there already.**

### Why replay alone is not enough

Ticket `07`'s derivation is: steady-state filter → TWS/TWA bins → **high
percentile** → polar point. Founding decision 7 justifies the percentile
because "polars describe best achievable speed". That is a reasonable-sounding
choice with an unquantified bias, and replay of a real race can never quantify
it — you don't know what the boat's true polar was on that day.

Here is the bias, computed from the noise model already in
`polars/generate-polars.js` (`sampleNoisy`, lines 139–174), which mimics logged
instrument data:

| Roll | Probability | Speed factor | Note |
|---|---|---|---|
| `roll < 0.2` | 20 % | `U(0.82, 0.92)` | Poor Trim |
| `0.2 ≤ roll ≤ 0.85` | 65 % | `U(0.97, 1.03)` | On Target |
| `roll > 0.85` | 15 % | `U(1.05, 1.15)` | Surfing/Planing |

Against that distribution, the **true** base speed sits at roughly the 52nd
percentile. So:

- median (50th) → −0.2 % vs truth
- 75th percentile → **+2.1 %**
- 90th percentile → **+8.3 %**

An 8 % over-statement of the polar propagates straight into sail suggestion and
into the target-speed feature the map lists as the next effort. Whether the real
answer is "use the 75th" or "use the 90th but subtract" or "the steady-state
filter removes the poor-trim tail so the bias is different" is an empirical
question — and it has an *answer*, in numbers, the moment there's a track whose
true polar is known. Without that, ticket `07` is settled by taste.

There is a second thing only ground truth can catch: **the TWA/TWS the pipeline
recovers is not the TWA/TWS the boat sailed.** The instrument reports apparent
wind; true wind is derived from AWA/AWS + boat speed + heading, and every step
of that derivation is a place to be wrong by a few degrees. A round-trip test
(known TWD/TWS → synthesise AWA/AWS → NMEA → app parses → app derives TWA/TWS →
compare) is the only way to test the app's true-wind maths at all. This is
directly ticket `05` question 2 ("true vs apparent — do we store what the
instrument gives us, our derived values, or both?").

### What "running the generator backwards" actually requires

The existing generator's ground truth is per-sail `{ twaBand, baseSpeeds }` —
speed in knots at TWS nodes 4/10/16/26, linearly interpolated
(`interpolateBaseSpeed`, lines 116–132). To go backwards you add:

1. **A course script** — a list of `{ durationSec, headingDeg, sail }` legs plus
   a TWD/TWS schedule (constant, or a slow oscillation ±10° / ±2 kn to make the
   steady-state filter earn its keep). Tacks are just two legs with a transition.
2. **A per-tick physics step at ~1 Hz** — TWA = normalised |TWD − heading| (the
   app's own `getTwa` convention, per `CONTEXT.md`); look up true boat speed
   from `interpolateBaseSpeed` + the sail's curve; apply the *existing*
   `sampleNoisy` speed-factor / TWS-jitter / TWA-jitter model. During a tack,
   ramp heading over ~10 s and knock speed down to ~40 % and recover — that's
   the signal ticket `07`'s steady-state filter must reject.
3. **Apparent-wind conversion** — standard vector maths, about 15 lines:
   `awa = atan2(TWS·sin(twa), TWS·cos(twa) + boatSpeed)`,
   `aws = hypot(TWS·sin(twa), TWS·cos(twa) + boatSpeed)`.
   Needed so the stream carries the *apparent* MWV a real vane produces, and the
   app has to do the true-wind derivation itself.
4. **Dead reckoning** — integrate heading + speed into lat/lon so RMC/GGA/VTG
   are self-consistent with VHW. Optionally add a current so SOG ≠ STW, which
   is a real and nasty source of polar error.
5. **Sentence emission + checksum** — MWV (R and T), MWD, VHW, HDG/HDT, RMC,
   VTG, GGA, at the per-sentence rates ticket `01`/`04` establish. XOR checksum
   is four lines.
6. **A track manifest** — same idea as the existing `*.manifest.json`: the seed,
   the TWD/TWS schedule, the leg list, the sail per leg, and the exact
   `{tws, twa, trueSpeed}` the generator drew from. That is the file the
   end-to-end assertion compares against.

### Cost and fit

- The seeded-PRNG idiom (`mulberry32`), the manifest convention, the noise
  recipe and the fleet ground truth are all **already in the file** and reusable
  verbatim.
- New code is roughly **250–400 lines** in the same style — comparable to
  `generate-polars.js` itself (305 lines).
- Zero new dependencies (`net`, `fs` are stdlib).
- It plugs into existing machinery: the repo already has an accuracy harness
  (`npm run eval:suggestions`) and a fixtures-with-manifests convention, so
  "does the pipeline recover the polar" becomes another scored variant rather
  than a new kind of thing.

**Do not extend `polars/generate-polars.js` itself** — it has one clear job
(emit CSV fixtures + manifests for the suggestion harness) and adding a TCP
server to it would muddy that. Put the track generator in a sibling module that
*imports* the fleet/ground-truth definitions, so there is one source of truth
for what the boat's real polar is. If the fleet constants need to move to a
shared `polars/fleet.js` to make that clean, that's a small refactor, not a
rewrite.

The honest counter-argument: the synthetic noise model is a guess until ticket
`04` measures the real one. True — but the harness is *parameterised* by the
noise model, so `04` upgrades it rather than invalidating it, and in the
meantime it catches sign errors, unit errors, off-by-180 errors and
percentile-bias errors that no amount of eyeballing a replay will.

---

## Question 4 — simulating the nasty parts

**Only a self-written server covers all of these.** None of the surveyed tools
has fault injection; the GUI simulators can at best be closed by hand. This is
the decisive argument for building rather than adopting. Each case, and how to
produce it:

| Failure mode | How to reproduce | Notes |
|---|---|---|
| **Mid-stream dropout** | `sock.end()` (graceful FIN) after N seconds | The easy case — the client gets a `close` event. Also do `sock.destroy()` to send RST. |
| **Dead socket that stays open** | Stop writing but keep the socket open | This is the *app-level* staleness case: TCP is fine, data isn't flowing. Ticket `05` q4 and `11` q5 both need it. |
| **True black-hole (peer vanished)** | `nft`/`iptables` DROP on the sim's port, or `SIGSTOP` the sim process, or kill the AP | Distinct from the above: the client's writes go unacknowledged and it only notices after TCP retransmit timeout (minutes) or an app-level heartbeat. This is what "phone left the boat" looks like and it is the one that silently costs a race. |
| **Malformed sentence** | Emit with a deliberately wrong checksum | `$WIMWV,42.0,R,16.3,N,A*00` |
| **Truncated sentence** | Write a partial line then a long pause, or then a new `$` | `$WIMWV,42.0,R,1` … then 5 s of nothing. |
| **Split across TCP writes** | Write one sentence in two `sock.write()` calls | **The most valuable single test here.** TCP is a byte stream, not a message stream; a parser that assumes one read = one sentence will pass every other test and fail on the water. |
| **Two sentences in one packet** | Concatenate before writing | The mirror image of the above. |
| **Garbage / binary noise** | Write random bytes mid-stream | Plotters do emit junk on power-up. |
| **Over-length sentence** | > 82 characters | NMEA's limit; a real reported issue against NMEASimulator. |
| **Empty fields** | `$WIMWV,,,,,V*35` | Status `V` = invalid; the instrument saying "I have no data". Must not be parsed as 0 kn. |
| **Field goes stale, others don't** | Stop emitting `VHW` while `MWV` keeps flowing | Exactly ticket `05` q4. **No off-the-shelf tool can do this.** |
| **Rate change** | Drop from 1 Hz to 0.2 Hz on one sentence type | Tests whether "complete enough set" logic stalls. |
| **A tack** | Scripted in the track model (Q3) | Heading swings through the wind over ~10 s, STW dips ~60 % and recovers, MWV angle flips e.g. 45° → 315°, tack changes starboard→port. |
| **Plotter reboot** | Close all sockets, `server.close()`, wait 30 s, `listen()` again | Ticket `11` q4: distinguishing "plotter rebooted" from "phone left". |
| **Address change** | Re-listen on a different IP | DHCP lease change, ticket `11` q2. |
| **Multiple clients** | Connect two clients | Zeus 3 behaviour **UNCONFIRMED** (ticket `01`); note that OpenCPN's TCP server accepts only one, so if the plotter is similar the app must handle refusal. |

Shape this as a scripted timeline the sim reads, e.g.

```
{ "at": 0,    "do": "sail",       "leg": "beat-stbd" }
{ "at": 240,  "do": "tack" }
{ "at": 600,  "do": "stale",      "sentences": ["VHW"], "forSec": 45 }
{ "at": 900,  "do": "corrupt",    "rate": 0.05 }
{ "at": 1200, "do": "silence",    "forSec": 30 }
{ "at": 1400, "do": "dropSocket" }
{ "at": 1430, "do": "restartServer", "afterSec": 30 }
```

so the same script is a reproducible regression test, not a manual poke. The
timeline is also the artefact that lets tickets `05`, `07`, `10` and `11` be
argued from evidence rather than from imagination.

---

## Question 5 — the no-internet WiFi trap

**Confirmed: a phone hotspot with mobile data disabled is a faithful
reproduction — with two conditions on the test setup. This should settle ticket
`11` question 3 without boat access.**

### Why it is faithful

The mechanism is Android's network *validation*, not anything specific to the
Zeus 3. From the Android docs:

> `NET_CAPABILITY_INTERNET` "indicates that the network is set up to access the
> internet. This is about *setup* and not actual *ability* to reach public
> servers… A carrier's mobile network typically has the `INTERNET` capability,
> while a local P2P Wi-Fi network typically doesn't."
>
> `NET_CAPABILITY_VALIDATED` "indicates that the network provides actual access
> to the public internet when it is probed. A network behind a captive portal or
> a network that doesn't provide domain name resolution doesn't have this
> capability."

And AOSP's Wi-Fi network selection doc on what happens next:

> "isUsable = true: The network is valid. The framework promotes it to the
> default network for system traffic. isUsable = false: The network is invalid.
> The framework avoids using it as the default, **triggering a fallback to
> mobile data**."

with the network considered good when "The network is validated (connected to
the internet) **or is user-approved for use without internet access**."

The Zeus 3's WiFi and a phone hotspot with data off are structurally identical
from the phone's point of view: DHCP on a private subnet, a default route that
goes nowhere, and Android's `generate_204` probe failing. Both therefore fail
validation, both get demoted, and in both cases a socket opened with no explicit
network binding leaves over cellular and never reaches the local IP. Same bug,
same fix.

### The two conditions

1. **The test phone must have working mobile data.** If the phone has no SIM or
   data is off, there is no better network to route around to, the unvalidated
   WiFi becomes the default by default, and the bug **will not appear** — you'd
   conclude wrongly that there's nothing to fix. Test both states deliberately.
2. **Do not tap "yes" on the "Wi-Fi has no internet access — stay connected?"
   prompt.** That sets the "user-approved for use without internet access" flag
   quoted above and permanently hides the bug for that SSID. If it's already
   been tapped, forget the network and rejoin. (Note this cuts both ways: it is
   also a legitimate *user-side workaround* worth documenting in `11`'s UX
   answer, alongside "turn mobile data off".)

### What it does *not* reproduce

- **GoFree / mDNS discovery.** A phone hotspot announces nothing. If ticket `11`
  goes the discovery route rather than "type an IP", the announcement traffic
  has to be faked — kplex's `gofree.c` gives the target: multicast `239.2.1.1`,
  UDP `2052`. **UNCONFIRMED** what a Zeus 3 actually puts in that packet; that
  is genuinely a ticket `04` question.
- **Marine-grade RF flakiness** — range, hull attenuation, the phone dropping to
  1 bar behind the mast. Not reproducible; accept it.

### The recommended rig (better than two phones)

Make the **Fedora desktop itself the access point**, so the simulator lives at
the gateway address:

```
nmcli device wifi hotspot ifname <wlan-iface> con-name Zeus3Sim \
     ssid Zeus3Sim password "sailplan1"
```

NetworkManager runs dnsmasq for DHCP/DNS and puts the AP on `10.42.0.1/24` by
default. The simulator then listens on `10.42.0.1:10110` and the phone points at
that. Advantages over a second phone: the desktop keeps its own internet on
ethernet, you can black-hole the port with `nft` to test the dead-socket case,
you can `nmcli con down Zeus3Sim` mid-race to test reconnection, and there's no
second device to keep charged. The only requirement is a WiFi adapter free for
AP mode.

### The fix, for ticket `11`

The app-side fix is a `ConnectivityManager` network binding, and **it already
exists off the shelf**. `react-native-tcp-socket` documents an Android-only
option: "Interface the socket should connect from. If not specified, it will
use the current active connection. The options are: `'wifi', 'ethernet',
'cellular'`." I read its Android implementation to check it does the right
thing:

```java
private void requestNetwork(final int transportType, @Nullable final String iotDeviceHost) {
    final NetworkRequest.Builder requestBuilder = new NetworkRequest.Builder();
    requestBuilder.addTransportType(transportType);   // TRANSPORT_WIFI
    ...
    cm.requestNetwork(requestBuilder.build(), new ConnectivityManager.NetworkCallback() { ... });
```

Crucially it adds **only** the transport type and **not** `NET_CAPABILITY_INTERNET`
— which is exactly what makes it match an unvalidated network. It also has a
branch that handles Android 12+ concurrent connections by filtering
`getAllNetworks()` for the right transport. Once bound, per the Android docs,
"All data traffic on the socket will be sent on this `Network`, irrespective of
any process-wide network binding".

So ticket `11` q3's answer is likely: **use `interface: 'wifi'` and verify it on
the hotspot rig**, with "disable mobile data" as the documented fallback rather
than the primary fix. (Whether `react-native-tcp-socket` is *the* library is
ticket `02`'s call, not this one.)

---

## Question 6 — recommendation and setup cost

### The combination

| # | Piece | Buys | Cost |
|---|---|---|---|
| 1 | `tools/nmea-sim/` — Node TCP server, replay mode | Q2 in full; unblocks `05` parser work | ~2 h |
| 2 | …fault-injection timeline | **Q4 in full** — the thing nothing else does; unblocks `05` q4/q5, `11` q4/q5 | ~4 h |
| 3 | …polar-backwards track generator + track manifest | **Q3** — end-to-end derivation test with a known answer; unblocks `07`, `10` | ~1 day |
| 4 | Signal K's `gofree-merrimac.log` as fixture #1 | Real Navico-family MWV/MWD/VHW/HDG **today**, no boat | ~0 (download one file) |
| 5 | Fedora as AP via `nmcli device wifi hotspot` | **Q5** — the no-internet trap, plus AP-kill for reconnect tests | ~1 h |
| 6 | NMEASimulator `.rpm` *or* OpenCPN+ShipDriver, installed | Cross-check our sentences parse in real software; hand-drive odd manoeuvres | ~30 min |

Roughly **two days total**, and items 1, 4 and 5 alone (about half a day) are
enough to take `05` and `11` off the boat's critical path immediately.

### Why not just adopt something

- **Signal K server** is the only maintained tool that does replay-over-TCP
  properly, and it is a fine belt-and-braces cross-check — but it is a large
  dependency to run a file through, and it cannot corrupt a sentence, hold a
  field stale, or half-close a socket. Q4 kills it as the primary.
- **NMEASimulator** has TCP + wind and is the quickest thing to click on, but it
  is closed-source, unreleased since 2023, GUI-only (so no regression tests),
  and its true-wind angle ignores heading (issue #28). Q3 kills it.
- **OpenCPN + ShipDriver** genuinely emits MWV/MWD/VHW over TCP and is the best
  *reference peer* we have, but it is GUI-only, single-TCP-client, and not
  scriptable. Q3 and Q4 kill it as the primary.
- **kplex** doesn't generate and doesn't pace. Keep it bookmarked for
  `gofree.c` and for the day a real multiplexer is wanted.
- Everything else is GPS-only, Windows-only, or doesn't exist.

The gap between "closest off-the-shelf tool" and "what tickets `05`, `07` and
`11` need to be answered" is about 300 lines of Node with no dependencies. Write
the 300 lines.

### Knock-on decisions this suggests for other tickets

- **`04`/`06`**: the raw capture format should carry per-sentence timestamps —
  NMEA v4 TAG block (`\c:<epoch>*hh\`) preferred, epoch-millis prefix as
  fallback. Without them, replay fidelity is guesswork.
- **`05`**: begin now against `gofree-merrimac.log`. It is real Navico-family
  output and already answers "what does the wind data actually look like" well
  enough to draft the row shape, with `04` as confirmation.
- **`07`**: the percentile choice should be *measured* against the synthetic
  track, not argued. Current noise model implies ~+8 % bias at the 90th
  percentile.
- **`11`**: `interface: 'wifi'` (ConnectivityManager `requestNetwork` with
  transport only, no INTERNET capability) is the likely fix; the hotspot rig
  proves it. Discovery (GoFree multicast `239.2.1.1:2052`) remains a genuine
  `04` question.

---

## Sources

**Tools surveyed**

- kplex README — https://github.com/stripydog/kplex/blob/master/README
- kplex `fileio.c` (file interface options; no delay option) — https://github.com/stripydog/kplex/blob/master/fileio.c
- kplex `gofree.c` (GoFree multicast `239.2.1.1:2052`) — https://github.com/stripydog/kplex/blob/master/gofree.c
- kplex repo metadata (last push 2024-02-25, 85★) — https://github.com/stripydog/kplex
- Signal K server `filestream.ts` — https://github.com/SignalK/signalk-server/blob/master/packages/streams/src/filestream.ts
- Signal K server `timestamp-throttle.ts` — https://github.com/SignalK/signalk-server/blob/master/packages/streams/src/timestamp-throttle.ts
- Signal K server `throttle.ts` — https://github.com/SignalK/signalk-server/blob/master/packages/streams/src/throttle.ts
- Signal K server configuration docs (TCP 10110, sample files, TAG-block timestamps) — https://github.com/SignalK/signalk-server/blob/master/docs/setup/configuration.md
- Signal K sample `gofree-merrimac.log` — https://github.com/SignalK/signalk-server/blob/master/samples/gofree-merrimac.log
- Signal K NMEA0183 Data Server guide — https://demo.signalk.org/documentation/Guides/NMEA0183_Data_Server.html
- OpenCPN manual — NMEA software list — https://opencpn-manuals.github.io/main/opencpn-plugins/misc/nmea-software.html
- OpenCPN manual — Connections — https://opencpn.org/wiki/dokuwiki/doku.php?id=opencpn:manual_basic:set_options:connections
- OpenCPN manual — Connections/Advanced (TCP server on `0.0.0.0`, one client, port 10110) — https://opencpn.org/wiki/dokuwiki/doku.php?id=opencpn:manual_basic:set_options:connections:advanced
- OpenCPN ShipDriver plugin manual — https://opencpn-manuals.github.io/main/shipdriver/index.html
- ShipDriver source (`createMWVASentence`, `createMWDSentence`, `PushNMEABuffer`) — https://github.com/Rasbats/shipdriver_pi/blob/master/src/shipdriver_gui_impl.cpp
- OpenCPN VDR plugin manual (raw NMEA record + 1x real-time playback) — https://opencpn-manuals.github.io/main/vdr/index.html
- NMEASimulator (panaaj) README + releases — https://github.com/panaaj/nmeasimulator
- NMEASimulator issue #3 — TCP server/client modes explained by maintainer — https://github.com/panaaj/nmeasimulator/issues/3
- NMEASimulator issue #28 — "TWA not respect COG", with `$WIMWV`/`$WIMWD` output — https://github.com/panaaj/nmeasimulator/issues/28
- NMEASimulator AppImage listing — https://appimage.github.io/NMEASimulator/
- captv89/nmea-simulator (Go; TCP 10110; MWV, VHW) — https://github.com/captv89/nmea-simulator
- Kafkar/NMEA_Simulator (Python; TCP; no wind) — https://github.com/Kafkar/NMEA_Simulator
- luk-kop/nmea-gps-emulator (GPS only) — https://github.com/luk-kop/nmea-gps-emulator
- ggsimulator (npm; GPRMC/AIVDM only; last publish 2022) — https://www.npmjs.com/package/ggsimulator
- Kave Oy tools (NMEA Simulator; Windows + com0com) — https://www.kave.fi/Apps/
- AvNav documentation — https://www.wellenvogel.net/software/avnav/docs/beschreibung.html?lang=en

**NMEA 0183 reference**

- NMEA Revealed (gpsd) — MWV, MWD, VWR, VHW, HDG, HDT, RMC, VTG, GGA, DPT field layouts — https://gpsd.gitlab.io/gpsd/NMEA.html
- NMEA 0183 Standard Committee — obsolete sentences (incl. VWT) — https://larsi.org/electronics/GPS/download/NMEAobsolete.pdf

**Android networking**

- Read network state — `NET_CAPABILITY_INTERNET` vs `NET_CAPABILITY_VALIDATED`, `requestNetwork` — https://developer.android.com/develop/connectivity/network-ops/reading-network-state
- AOSP Wi-Fi network selection — validated / user-approved-without-internet, "fallback to mobile data" — https://source.android.com/docs/core/connect/wifi-network-selection
- AOSP Network selection — https://source.android.com/docs/core/connect/network-selection
- `android.net.Network` — `bindSocket`, `getSocketFactory`, `getAllByName` — https://developer.android.com/reference/android/net/Network
- Android 12 concurrent peer-to-peer + internet connections — https://developer.android.com/about/versions/12/behavior-changes-12#concurrent-connections
- react-native-tcp-socket README (`interface: 'wifi' | 'ethernet' | 'cellular'`, Android-only) — https://github.com/Rapsssito/react-native-tcp-socket
- react-native-tcp-socket `TcpSocketModule.java` (`requestNetwork` with `TRANSPORT_WIFI`, no INTERNET capability) — https://github.com/Rapsssito/react-native-tcp-socket/blob/master/android/src/main/java/com/asterinet/react/tcpsocket/TcpSocketModule.java

**Linux AP setup**

- RHEL 8 — Configuring RHEL as a WPA2/WPA3 Personal access point (`nmcli device wifi hotspot`, dnsmasq, `10.42.0.1/24`) — https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/configuring_and_managing_networking/proc_configuring-rhel-as-a-wpa2-or-wpa3-personal-access-point_configuring-and-managing-networking

**In-repo**

- `polars/generate-polars.js` — seeded PRNG, fleet ground truth, `sampleNoisy` noise model, manifest format
- `polars/fixtures/*.manifest.json` — the ground-truth manifest convention this proposal extends
- `CONTEXT.md` — TWA/TWS/TWD and tack conventions used in the track model above

## Unconfirmed / open

- **AvNav** — no documented built-in NMEA generator or dummy source found. Not
  ruled out, just unverified.
- **NMEASimulator's exact sentence set** — only `WIMWV` (R and T) and `WIMWD`
  are confirmed from user-quoted output; the full list is undocumented and the
  source is closed.
- **Whether NMEASimulator issue #28 (TWA ignoring COG) is fixed** — the issue is
  closed but there has been no release since 2023-11-10. Assume unfixed until
  tested.
- **Zeus 3 specifics** — sentence set, rates, whether it accepts multiple TCP
  clients, and what its GoFree announcement contains. All ticket `01`/`04`.
