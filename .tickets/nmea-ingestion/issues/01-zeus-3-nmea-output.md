# 01 — What the Zeus 3 actually puts on the wire

Type: research
Status: resolved
Blocked by: —
Map: [map.md](../map.md)
Findings: [research/01-zeus-3-nmea-output.md](../research/01-zeus-3-nmea-output.md)

## Question

What data can a **B&G Zeus 3** chartplotter be made to emit over TCP/WiFi, and
in what form? Specifically:

1. **Protocol.** Does it serve NMEA **0183** sentences over TCP, NMEA **2000**
   (as PGNs, or tunnelled/converted), or both? If both, which is the better
   target and why? Note that NMEA 2000 is a binary CAN protocol — establish
   whether what's on the WiFi is actually 0183-formatted text regardless of
   what the instrument network speaks internally.
2. **Transport.** TCP server, UDP broadcast, or both? Default port(s)? Does the
   plotter act as a WiFi access point, join an existing network, or either?
3. **Sentence set.** Which sentences are emitted, and which carry the fields
   this feature needs:
   - True wind speed and angle — `MWV` (with the true/apparent flag), `VWT`
   - Apparent wind — `MWV` apparent, `VWR`
   - Boat speed through water — `VHW`
   - Speed over ground and course — `RMC`, `VTG`
   - Heading — `HDG`, `HDT`
   - Position and time — `RMC`, `GGA`
4. **True vs apparent.** Does the Zeus compute and emit *true* wind directly,
   or only apparent, leaving the app to derive true from apparent + boat speed
   + heading? This materially changes the parsing work and the error budget.
5. **Update rate.** How many sentences per second, in total and per sentence
   type? This sizes the raw log and settles the sampling question in `05`.
6. **Configuration.** What must be enabled on the plotter itself (an NMEA/WiFi
   output setting, a "GoFree" or similar mode) before any of this is
   available?

Prefer primary sources: B&G / Navico manuals for the Zeus 3, the NMEA 0183
sentence reference, and Navico's GoFree / NMEA-over-TCP documentation.
Community reports (forums, OpenCPN / SignalK issue trackers) are acceptable as
corroboration but flag them as such — they are frequently wrong about ports and
defaults.

Findings are provisional until `04` confirms them against the actual boat.

## Answer

Full findings with citations:
[`research/01-zeus-3-nmea-output.md`](../research/01-zeus-3-nmea-output.md).
The most valuable source was Navico's **GoFree Tier 1 Networking
Specification**, not the Zeus 3 manual.

1. **Protocol — plain NMEA 0183 v4.00 ASCII, not 2000.** The plotter is a
   gateway: instruments speak N2K to it over the Micro-C backbone, it
   re-encodes to 0183 text on the network port. No PGNs, no binary, nothing to
   tunnel. **The NMEA 2000 question on the map is therefore closed** — there is
   no 2000-over-WiFi option to weigh up.
2. **Transport — TCP unicast, port 10110**, plotter as WiFi access point (the
   phone joins it). UDP is explicitly rejected for data by the Tier 1 spec.
   Discovery exists via UDP multicast `239.2.1.1:2052` (JSON, 1 Hz) and Bonjour
   `_nmea-0183._tcp`. Caveat: Tier 1 treats the port as *dynamic and
   announced*, so 10110 is a default, not a guarantee — which is an argument
   for `11` supporting discovery rather than only a typed-in port.
3. **Sentence set** — `MWV` (R and T), `MWD`, `VHW`, `VTG`, `RMC`, `GGA`,
   `GLL`, `ZDA`, `HDG`, depth/temp/log, `VPW`, `XDR` (heel/trim). Two traps:
   `VWR`/`VWT` are **not emitted** (don't write those parsers), and `HDT` is
   **receive-only**, so true heading must be computed from `HDG` magnetic plus
   variation. Also, the Zeus 3 manual prints `VHM` where the Zeus3S manual and
   Tier 1 both print `VHW` — a typo that would lead a careful reader to
   conclude boat speed through water isn't available. It is.
4. **True wind is emitted directly.** Tier 1 lists `MWV` twice, as separate
   "(Relative)" and "(True)" rows, plus `MWD`. **No apparent→true derivation is
   needed** — a meaningful reduction in scope and error budget. The app must
   branch on `MWV` field 2 (`R` vs `T`), not on sentence type; that is an easy
   and silent bug.
5. **Update rate — every polar-relevant sentence is 1 Hz** (`HDG` 10 Hz,
   `GGA`/`GLL` 5 Hz, everything else 1 Hz). So "native rate" and "1 Hz" are the
   *same decision* for TWA/TWS/STW/SOG; there is no faster wind or boat-speed
   data being discarded. Raw stream ≈ 2.3–2.7 kB/s ⇒ **~8–10 MB/hour, ~25–30 MB
   per 3-hour race** (~3 MB gzipped). Confirms founding decision 2.
6. **Configuration — essentially nothing.** Set internal wireless to Access
   Point mode, read SSID/key and IP/port off the plotter, connect. No GoFree
   account, no companion app, no pairing, no password on the data itself.

### Two findings that create new work

- **Water- vs ground-referenced true wind.** N2K's wind PGN distinguishes
  boat/water/ground-referenced true wind, but 0183's `MWV` has a single `T`
  flag that cannot express which. **For polars we want water-referenced** — a
  ground-referenced true wind bakes in tidal current and will systematically
  skew every polar derived in a tideway. Which one the Zeus emits is
  undocumented and unresolvable from the desk. Handed to `05` as a decision and
  to `04` as a measurement.
- **Plotter-local calibration is not shared.** The manual states boat-speed and
  other offsets entered on the plotter apply *only to that unit* and are not
  propagated to other devices. Whether the Ethernet stream carries locally
  calibrated or raw bus values is not stated. This sharpens the calibration
  risk already on the map.

### Confidence and what stays open

Recommendation from the research: parse and log `MWV,R`, `MWV,T` *and* `MWD` —
derive polars from `MWV,T`, but keep apparent, since it costs nothing and lets a
later ticket re-derive true wind independently if the instrument's trig proves
suspect.

Load-bearing uncertainties, all handed to `04`:

- Whether the "Serial output" checkbox gates the *Ethernet* stream (probably
  not; the manuals contradict each other).
- Whether `MWV,T` is actually populated on this boat, and its reference frame.
- Whether an Android phone gets a real DHCP address on the plotter's AP — the
  manual contradicts itself on this within two pages, and a link-local address
  would fail with no obvious cause.
- Several forum posts assert the Zeus 2/3/3S WiFi module doesn't send NMEA at
  all. The research judges this wrong (both manuals name wireless explicitly)
  but cannot exclude a firmware regression. **This is the first thing the boat
  trip should settle** — everything else is moot if it's true.
- The Tier 1 rate table dates to 2013 and predates the Zeus 3 (2017). No newer
  published version exists, so the rates are documented platform behaviour, not
  a Zeus 3 measurement.
