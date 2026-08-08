# 12 — Simulating NMEA at home

Type: research
Status: resolved
Blocked by: —
Map: [map.md](../map.md)
Findings: [research/12-nmea-simulator.md](../research/12-nmea-simulator.md)

## Question

**Boat access is the scarcest resource on this map.** Nothing in this feature
should require being on the water to develop or test. Establish how to produce
a realistic NMEA stream on a desk.

1. **Existing tools.** Survey what already exists and can serve NMEA 0183 over
   TCP on a laptop — candidates include OpenCPN's built-in simulator, kplex,
   SignalK's simulator/playback plugins, AvNav, `nmeasimulator`, and the
   various `nmea-simulator` npm packages. For each: does it serve over **TCP**
   (not just a serial port), can it emit the wind sentences this feature needs
   (`MWV`/`VWT`/`VHW`, not just GPS), is it scriptable, and does it run on
   Linux? Many NMEA simulators are GPS-only, which would make them useless
   here — check this specifically.
2. **Replaying a real capture.** Once `04` exists, replaying that file over a
   TCP socket at the original timing is the highest-fidelity option and is
   trivial to write. Confirm nothing more is needed for that case.
3. **Synthesising a track.** Replay only covers conditions already sailed. To
   test the derivation logic in `07` you want a track with *known ground
   truth* — sail a synthetic course at known TWS/TWA and check the pipeline
   recovers the polar you started from. Note that `polars/generate-polars.js`
   already generates polar data with ground-truth manifests; running it
   backwards (polar → synthetic track → NMEA sentences) would give an
   end-to-end test with a known answer. Assess whether that's worth building
   or overkill.
4. **Simulating the nasty parts.** The failure modes matter more than the happy
   path. Can the chosen approach reproduce: mid-stream dropouts, a dead socket
   that stays open, malformed or truncated sentences, fields going stale while
   others keep updating, and a tack? These are what `05`'s staleness/gap
   questions and `11`'s reconnection logic need to be tested against.
5. **The no-internet WiFi trap.** `11`'s worst gotcha — Android routing around
   a WiFi network with no internet — is reproducible at home with a phone
   hotspot that has mobile data disabled. Confirm that's a faithful enough
   reproduction to settle `11` without the boat.
6. **Recommendation.** One approach (or a small combination), with what it
   costs to set up.

### Concrete target, from `01`

`01` resolved after this ticket's research agent was launched, so the agent's
findings won't reflect it. The simulator must reproduce **exactly** this, since
it's what the Zeus 3 actually emits:

| Sentence | Rate | Carries |
| --- | --- | --- |
| `MWV` with `R` flag | 1 Hz | AWA + AWS |
| `MWV` with `T` flag | 1 Hz | **TWA + TWS — the polar inputs** |
| `MWD` | 1 Hz | TWD + TWS |
| `VHW` | 1 Hz | Boat speed through water |
| `VTG`, `RMC` | 1 Hz | SOG, COG, position, time |
| `HDG` | 10 Hz | Magnetic heading (`HDT` is never sent) |

Served over **TCP, port 10110**, ~2.3–2.7 kB/s total.

Two consequences when judging the surveyed tools:

- **`VWR`/`VWT` are never emitted by the Zeus.** A simulator that offers those
  but not `MWV` is not useful, and emitting them would train the parser on
  sentences it will never see.
- **The `MWV` twice problem is the sharpest test.** The same formatter carries
  both apparent and true, differing only in field 2. A simulator that emits
  only one `MWV` stream cannot exercise the most plausible parser bug in this
  feature — mixing apparent and true speeds into the same column. Weight this
  heavily; it may rule out otherwise-attractive tools and favour writing our
  own emitter.

Resolving this should let `05`, `06`, `07`, `10` and `11` proceed on documented
behaviour plus simulation, leaving `04` as a **confirmation** step rather than a
prerequisite.

## Answer

**Build our own ~300-line dependency-free Node TCP simulator**
(`net.createServer`) with three modes — replay, scripted sail, fault injection —
alongside two off-the-shelf pieces. Build ticket: `14`. Full findings:
[`research/12-nmea-simulator.md`](../research/12-nmea-simulator.md).

### There is real B&G-family wind data available today

**Signal K server ships `samples/gofree-merrimac.log`** — 274 KB captured off a
Navico **GoFree** gateway, the same family as the Zeus 3. Sentence census run by
the research agent: `$WIMWV` ×282 (**both `R` and `T`**), `$WIMWD` ×141,
`$SDVHW` ×142, `$SDHDG` ×1375, `$IIXDR` ×141.

This is usable **before `04`**, and it exercises the `MWV`-twice case that this
ticket identified as the sharpest test. It further reduces the boat's role.

### Off-the-shelf tools: surveyed and mostly rejected

- **OpenCPN ShipDriver plugin** — verified in source
  (`shipdriver_gui_impl.cpp:864–883`) to push `WIMWV` + `WIMWD` + `VHW`;
  OpenCPN re-serves over TCP when the address is `0.0.0.0`, single client only.
  Usable, awkward.
- **NMEASimulator (panaaj)** — TCP server confirmed, `$WIMWV`/`$WIMWD` output
  quoted in issue #28. **Disqualified**: its true-wind angle ignores COG, so
  it's correct only when heading north. No release since 2023-11-10, closed
  source. For a feature whose entire purpose is TWA accuracy, this is fatal.
- **kplex** — wrong shape; it multiplexes rather than generates, and its file
  interface has no throttle (`fileio.c`), so it blasts a log at line speed.
  **But** it contains `gofree.c` implementing Navico GoFree discovery on
  multicast `239.2.1.1:2052` — a working reference implementation of what `01`
  documented, directly useful to `11`.
- **The npm packages this ticket speculated about do not exist.**
  `nmea-simulator`, `nmeasimulator` and `nmea-sim` all 404 on the registry. The
  nearest, `ggsimulator`, is GPRMC/AIVDM only — no wind — and last published
  2022.
- **Nothing off the shelf can do fault injection.** None can hold `VHW` stale
  while `MWV` keeps flowing, split a sentence across two TCP writes, or
  half-close a socket. That gap is the whole justification for building.

### Ground-truth synthetic track: worth building, and it already paid off

The argument turned out to be quantitative rather than aesthetic. Against the
noise model already in `polars/generate-polars.js` (20% at 0.82–0.92×, 65% at
0.97–1.03×, 15% at 1.05–1.15×), true speed sits at roughly the **52nd
percentile** — so a **90th-percentile derivation overstates the polar by
~8.3%**, and a 75th by ~2.1%.

**No replay of a real race can reveal that**, because a real race has no ground
truth. This directly challenges founding decision 7's "high percentile" and is
handed to `07`.

Build it as a **sibling module**, not inside `generate-polars.js`. The generator
already supplies the seeded PRNG, manifest convention and noise recipe;
marginal cost ~250–400 lines.

### Two findings that land on other tickets

- **`react-native-tcp-socket`'s `interface: 'wifi'` is very likely the fix for
  `11`'s no-internet trap.** The research read `TcpSocketModule.java`: it calls
  `ConnectivityManager.requestNetwork` with `TRANSPORT_WIFI` and deliberately
  **does not** request `NET_CAPABILITY_INTERNET` — exactly what matches an
  unvalidated network. **This independently corroborates `02`, which reached the
  same conclusion by a different route.** Two agents, two paths, same answer.
- **The raw capture in `04` must carry per-sentence timestamps** (NMEA v4 TAG
  block preferred) or replay fidelity is guesswork. The GoFree sample is a bare
  dump with no timestamps and can only be paced by assumption. Handed to `04`
  and `06`.

### Reproducing the no-internet trap at home: yes, faithfully

Two conditions: the test phone must have **working mobile data** (otherwise the
bug cannot appear), and you must **not** tap "stay connected" on the
no-internet prompt — that sets Android's user-approved flag and hides the
behaviour permanently.

Recommended rig: make the **Fedora box itself the AP** via
`nmcli device wifi hotspot` (dnsmasq, `10.42.0.1/24`) rather than using a second
phone. It also allows `nft`-dropping the port for black-hole tests and killing
the AP for reconnect tests — which no phone hotspot can do cleanly.

### Cost

~2 days total. The **first half-day** (replay + the GoFree fixture + the hotspot
rig) is what takes `05` and `11` off the boat's critical path.
