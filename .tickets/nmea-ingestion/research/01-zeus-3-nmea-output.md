# 01 — What the Zeus 3 actually puts on the wire

Research answer for [issues/01-zeus-3-nmea-output.md](../issues/01-zeus-3-nmea-output.md).
Provisional until confirmed on the boat by `04`.

## Summary / verdict

**The Zeus 3 serves plain-text NMEA 0183 sentences over a TCP socket on its
WiFi/Ethernet interface, on port 10110 by default, and true wind is on that
stream.** The app never has to touch NMEA 2000 or CAN framing.

The short version:

| Question | Answer | Confidence |
| --- | --- | --- |
| Protocol | **NMEA 0183 v4.00 ASCII text**, bridged from the boat's NMEA 2000 bus by the MFD. No PGNs, no binary, no tunnelling. | High — primary |
| Transport | **TCP, unicast, one server socket on the MFD.** Not UDP. Port **10110** shown as the default in the Zeus3 manual screenshot. Discovery via UDP multicast `239.2.1.1:2052` and Bonjour `_nmea-0183._tcp`. | High for TCP; high-ish for 10110 (manual screenshot + OpenCPN doc, but the manual calls the dialog the source of truth) |
| AP vs client | Internal WiFi is **either**: Access Point mode (phone joins the plotter) or Client mode (plotter joins a hotspot) — one at a time. AP mode is the intended path for tablets/phones. | High — primary |
| Sentence set | `MWV` (both R and T), `MWD`, `VHW`, `VTG`, `RMC`, `GGA`, `GLL`, `ZDA`, `HDG`, `DBT`/`DPT`/`MTW`/`VLW`, `VPW`, `XDR` (heel/trim), plus nav + AIS. | High — primary |
| **True wind** | **Emitted directly.** `MWV,<angle>,T,...` gives TWA+TWS; `MWD` gives TWD+TWS. The app does **not** need to derive true from apparent. | High that it's *specified*; **medium that it's populated on this boat** — depends on the boat's wind instrument and on boat-speed/heading being present. Verify on boat. |
| Update rate | Polar-relevant sentences (`MWV` ×2, `MWD`, `VHW`, `VTG`, `RMC`) are all **1 Hz**. `HDG` is 10 Hz, `GGA`/`GLL` 5 Hz. Roughly **2–3 kB/s** total ⇒ **~8–11 MB/hour** raw. | Medium — the rate table is primary but from a 2013-era platform spec |
| Configuration | Essentially **nothing** beyond putting the plotter's WiFi in Access Point mode and joining it. The Ethernet/WiFi 0183 dialog is read-only (IP / MAC / Port) — there is no enable toggle and no sentence picker for it. | Medium — inferred from manual screenshots; **verify on boat** |

**Two consequences that matter for the rest of the map:**

1. **`05` (sampling) is largely settled by the wire.** Every field a polar needs
   — TWA, TWS, STW, SOG/COG, position — arrives at 1 Hz. Capturing "at the
   device's native rate" *is* 1 Hz for polar purposes. There is no faster wind
   or boat-speed data to be had over this transport, so a 1 Hz normalised
   sample loses nothing. Only heading (10 Hz) and position (5 Hz) are faster,
   and neither drives a polar point.
2. **The parsing work is small.** `MWV` + `VHW` + `RMC` covers the whole polar
   need in three sentence types. No apparent→true trigonometry, no error budget
   from doing that trig ourselves with a possibly-miscalibrated paddle wheel.
   (The *instrument's* own trig is still an error source — see `map.md` →
   "Instrument calibration".)

**The single biggest risk to this whole plan** is not the protocol; it is
whether this particular Zeus 3's software revision still serves the stream, and
whether an Android phone gets a usable IP when it joins the plotter's AP. Both
are in the verify-on-boat list.

---

## 1. Protocol — NMEA 0183, not 2000

**It is 0183-formatted ASCII text on the wire, regardless of what the
instrument network speaks internally.**

The Zeus 3 Installation Manual has a section literally titled *"NMEA 0183 over
Ethernet"*:

> NMEA 0183 data stream is also output over ethernet, which is made available to
> tablet devices and PCs, via the internal wireless. The ethernet dialogue
> provides IP and port data typically required for configuring the application
> on the third party device.
>
> — *Zeus3 Installation Manual*, "Software Setup", p. 40

Navico's own GoFree Tier 1 specification — the platform-level document that this
feature implements — is explicit about the encoding:

> Messages are formatted using NMEA0183 version 4.00. Readers are referred to
> that specification for a detailed explanation of the protocol.
>
> — *GoFree Tier 1 Networking Specification*, §4.1

So the MFD is acting as a **gateway**: the boat's instruments talk NMEA 2000
(binary CAN) to the plotter over the Micro-C backbone, and the plotter
re-encodes the selected data as 0183 sentences and pushes them out the network
port. The Tier 1 spec confirms the bridging direction:

> Most types of NMEA0183 data are bridged on to the NMEA2000 network and will
> therefore be available to the gateway MFD via NMEA2000.
>
> — *GoFree Tier 1 Networking Specification*, §4.8.1

There is **no NMEA 2000 / PGN option over WiFi** on this generation. The Zeus 3
manual even warns that the Ethernet stream is a lossy re-encoding, not a peer
link:

> Note: Other MFDs cannot decode this information back to NMEA 0183, to use the
> data as a source. To share data a physical NMEA 2000 or NMEA 0183 connection
> is still required.
>
> — *Zeus3 Installation Manual*, p. 40

### Which is the better target

Not a real choice — 0183-over-TCP is the only thing on the WiFi. It is also the
right target on its merits: line-delimited ASCII with a checksum, trivially
parsed in JS, trivially logged verbatim to a file, and trivially replayed by the
simulator that `12` will build. A raw log of this stream is human-readable,
which makes the review-and-promote workflow debuggable.

### One thing the gateway takes away

Because the MFD picks **one source per data type** before re-encoding, the app
sees the plotter's chosen source, not everything on the bus:

> The GoFree gateway will only transmit one source of data for each data type.
> [...] The same applies to the B&G Zeus, data selected in the "default" group
> will be transmitted.
>
> — *GoFree Tier 1 Networking Specification*, §4.5

So if the boat has two wind sources or two GPS units, what lands in the log is
whatever the plotter's *default network group* has selected. That is fine for
this feature but worth knowing when data looks wrong.

---

## 2. Transport — TCP server, port 10110, plotter as access point

### TCP, unicast, not UDP

The GoFree Tier 1 spec is unambiguous, and explains *why*:

> In order to receive Tier 1 data, clients can create a TCP connection to any of
> the MFDs transmitting to the multicast address.
>
> — §4

> IEC61162-450 is based on multicast UDP for message transmission. For
> transmission of data to a small number of clients over wireless networks,
> unicast is preferred. TCP is convenient since there are a number of existing
> applications for mobile devices that can process TCP streams of NMEA0183 data.
>
> — §4.8.2

UDP appears **only** for service discovery, never for the data itself. Practical
implication: the app needs a plain TCP client socket (React Native has no
built-in one — `react-native-tcp-socket` or similar is the likely dependency,
which `map.md` already notes is missing).

### Port

**10110.** This comes from a screenshot in the Zeus 3 Installation Manual
itself. The *NMEA0183 Over Ethernet* dialog on p. 40 shows three read-only
fields:

```
NMEA0183 Over Ethernet
  ETHERNET
  IP address    172.29.245.39
  MAC address   D8:FC:93:8B:71:D5
  Port          10110
```

10110 is the IANA-registered port for `nmea-0183`, so this is the expected
value. But note a genuine tension in the sources:

- The **GoFree Tier 1 spec** treats the port as *dynamic and announced*, not
  fixed: the discovery JSON carries a `Port` field and the spec's own example
  value is `80`, not 10110 (§2.1). The spec was written for the NSS 2.x
  generation.
- The **Zeus 3 manual** shows 10110 and describes the dialog as the place you go
  to read the port off, implying it could differ.

**Resolution: treat 10110 as the default and the discovery announcement as
authoritative.** Do not hard-code the port as the only path; read it from the
dialog on the boat, and ideally implement discovery (below) so the app is
correct whatever it is. The IP is definitely not hard-codeable — the manual's
own example (`172.29.245.39`) and the OpenCPN guide's (`192.168.0.2`) differ.

*Corroboration only (community, flagged as such):* the OpenCPN project's own
B&G how-to says "Note the IP Address [...] Also note the Port number, 10110
which is the default for transmitting NMEA 183 sentences over a network."
Various Cruisers Forum / Sailing Anarchy posts report Zeus units streaming on
10110. These agree with the manual, which is why I'm reasonably confident — but
they are exactly the kind of source the ticket warns about, so the manual
screenshot is the load-bearing citation, not them.

### Discovery

Two mechanisms, both documented by Navico:

- **UDP multicast** — join `239.2.1.1`, bind port `2052`, and read a 1 Hz JSON
  announcement:

  ```json
  { "Name": "Name", "IP": "N.N.N.N", "Model": "Model",
    "Services": [ { "Service": "nmea-0183", "Version": N, "Port": N } ] }
  ```

  Legacy units (NSS 2.0 era) used port `2050` with a comma-separated payload
  instead. Clients should treat an MFD as gone after 2 s of silence.
  (*Tier 1 spec* §2.1 + Appendix A.)
- **Bonjour/mDNS** — the service is advertised as `_nmea-0183._tcp`
  (*Tier 1 spec* §2.2).

For an Android app, the multicast route is the simpler of the two, but Android
requires an explicit `MulticastLock` to receive multicast — a known footgun
worth flagging to whoever builds `02`/the connection layer. Falling back to
"user types the IP and port they read off the plotter" is a perfectly reasonable
v1, and matches how every third-party nav app documents this.

### Access point vs client mode

The internal WiFi does one or the other, never both:

> If the internal wireless is set to **Access Point** (Internal Wifi) mode,
> smartphones and tablets can access the unit to view and control (tablet only)
> it. [...] **Client Mode** allows the unit internet access via a wireless
> hotspot.
>
> — *Zeus3 Installation Manual*, "Wireless devices → Mode", p. 37

> To use smartphones and tablets to view and control the system, wireless
> functionality must be disconnected from the wireless hotspot (in Access point
> mode).
>
> — *Zeus3 Operator Manual*, "GoFree Link", p. 104

Mode flips implicitly, which is a UX trap worth knowing:

> Connecting to a wireless hotspot changes the wireless mode to Client mode.
> [...] To disconnect from a wireless hotspot [...] This changes the wireless
> mode to Access point mode.
>
> — *Zeus3 Operator Manual*, p. 104

Simultaneous AP + client needs a second radio:

> If it is desirable to have the MFD accessible to a tablet while also having
> internet access for GoFree store and Insight Genesis, it is necessary to use
> two wireless units - one must be in Client mode, the other in Access Point
> mode.
>
> — *Zeus3 Installation Manual*, p. 38

**Expected setup for SailPlan:** plotter in Access Point mode, SSID like
`GoFree wireless xxxx`, network key readable from *Wireless settings → Wireless
devices → Internal wireless*; the Android phone joins that SSID and opens a TCP
socket to the plotter's IP:10110. The phone will have **no internet** while
recording, since Android will be attached to a network with no route out — worth
designing for (the app must not need connectivity mid-race, and Android may
try to auto-switch away from a no-internet network unless told not to).

Whether the TCP server also answers when the plotter is in **Client mode** (i.e.
plotter and phone both joined to the *phone's* hotspot, which would keep the
phone's mobile data alive) is **not documented anywhere I could find**. The
Zeus3S manual's phrasing — "output and made available to tablet devices and PCs,
via WiFi or Ethernet connection" — suggests the server is interface-agnostic and
would work, but that is inference. On the verify list.

---

## 3. Sentence set

Two source lists, and they differ. This matters, so both are given.

### (a) The Ethernet/WiFi stream — GoFree Tier 1

This is the list that actually describes what arrives over TCP, with Navico's
stated output rates:

| Sentence | Data | Rate |
| --- | --- | --- |
| `GGA` | GPS fix data (position, time, quality) | 5 Hz |
| `GLL` | Lat/long | 5 Hz |
| `GSA` & `GSV` | DOP / satellites | 1 Hz |
| `VTG` | **Course over ground and ground speed** | 1 Hz |
| `ZDA` | Time and date | 1 Hz |
| `AAM` `APB` `BOD` `BWC` `BWR` `RMB` `XTE` | Waypoint/autopilot navigation | 1 Hz each |
| `RMC` | **Recommended minimum: time, position, SOG, COG, date, variation** | 1 Hz |
| `DBT` `DPT` | Depth | 1 Hz |
| `MTW` | Water temperature | 1 Hz |
| `VLW` | Ground/water distance log | 1 Hz |
| `VHW` | **Water speed and heading (STW)** | 1 Hz |
| `HDG` | **Heading, deviation and variation** | 10 Hz |
| `MWV` | **Wind speed and angle (Relative / apparent)** | 1 Hz |
| `MWV` | **Wind speed and angle (True)** | 1 Hz |
| `MWD` | **Wind direction and speed (TWD + TWS)** | 1 Hz |
| `VPW` | VMG to wind | 1 Hz |
| `TLL` `TTM` | MARPA targets | 1 Hz |
| `VDM` `VDO` | AIS | 1 Hz |
| `XDR` | Proprietary: heel, trim, barometric pressure | 1 Hz |

— *GoFree Tier 1 Networking Specification*, §4.7.

The `XDR` line is worth calling out because it is heel angle, and heel is a real
covariate for boat speed:

```
$IIXDR,A,2.5,D,HEEL,A,-0.2,D,TRIM,P,1.016,B,BARO
```

Not needed for v1, but it's free in the log if we capture the raw stream
verbatim (which founding decision 2 already commits to), so a future ticket
could use it without another trip to the boat.

### (b) The serial port TX list — Zeus3 Installation Manual appendix

The manual's *"NMEA 0183 supported sentences"* appendix describes the **serial**
port and gives a shorter transmit set:

- **GPS TX:** `GGA` `GLL` `GSA` `GSV` `VTG` `ZDA` `GLC`
- **Navigation TX:** `AAM` `APB` `BOD` `BWC` `BWR` `RMC` `RMB` `XTE` `XDR`
- **Sonar TX:** `DBT` `DPT` `MTW` `VLW` `VHM` *(see note)*
- **Compass TX:** `HDG` only (RX also accepts `HDT`, `HDM`)
- **Wind TX:** `MWV`, `MWD`
- **MARPA TX:** `TLL`, `TTM`

> **Note on `VHM`:** the Zeus 3 manual prints `VHM` in the Sonar group. `VHM` is
> not a valid NMEA 0183 sentence formatter. The equivalent table in the **Zeus3S
> Installation Manual** prints `VHW — Water speed and heading — RX ✓ TX ✓` in
> exactly that slot, and the GoFree Tier 1 spec lists `VHW`. This is a
> typographic error in the Zeus 3 manual; the sentence is `VHW`. Flagging it
> because a naive reader of the Zeus 3 manual alone would conclude boat speed
> through water is not transmitted, which is wrong.

Also note `RMC` appears in the Zeus 3 nav TX list and in the Tier 1 list, but is
*absent* from the Zeus3S manual's equivalent table (which lists only `RMB` under
navigation TX). I could not resolve whether that is an omission in the 3S
manual or a real change. It does not matter much — `GGA` + `VTG` + `ZDA` cover
position, time, SOG and COG without `RMC` — but the app should not *require*
`RMC`.

### Mapping to what this feature needs

| Need | Sentence | Field | Notes |
| --- | --- | --- | --- |
| **TWA + TWS** | `MWV` with reference `T` | `$--MWV,<angle>,T,<speed>,<unit>,<status>` | Angle is **relative to the bow, 0–359°**. Must be folded to 0–180° + tack to match SailPlan's `TWA` convention in `CONTEXT.md`. |
| **TWD + TWS** | `MWD` | `$--MWD,<dir>,T,<dir>,M,<speed>,N,<speed>,M` | Compass-referenced true wind direction — the same quantity as SailPlan's `TWD`. Carries both true- and magnetic-north versions, and speed twice in two units. |
| **AWA + AWS** | `MWV` with reference `R` | same layout | Emitted alongside the true one. Same talker, same formatter — **the app must branch on field 2 (`R` vs `T`), not on the sentence type.** Easy bug. |
| **Boat speed through water** | `VHW` | field 5 = speed in knots (`N`) | Also carries true and magnetic heading in fields 1–4, which may or may not be populated. |
| **SOG / COG** | `RMC` fields 7/8, or `VTG` fields 1/5 | | Both emitted at 1 Hz; prefer whichever proves populated. |
| **Heading** | `HDG` | magnetic heading + deviation + variation | **`HDT` (true heading) is NOT transmitted** — it is receive-only. True heading must be computed as magnetic + variation from `HDG` fields 4/5 (or taken from `RMC` field 10). |
| **Position + time** | `RMC` / `GGA` / `ZDA` | | `GGA` has no date, only time-of-day. `RMC` and `ZDA` carry the date. |

Field layouts above are per the NMEA 0183 reference in *NMEA Revealed* (gpsd).

`VWR` and `VWT` — named in the ticket as possible apparent/true wind carriers —
**are not emitted by this platform at all.** They are deprecated in favour of
`MWV`. Do not write parsers for them.

---

## 4. True vs apparent — **true wind is emitted directly**

This is the answer that most changes the app's work, so it gets the strongest
evidence available.

**The GoFree Tier 1 supported-sentence table lists `MWV` twice, as two separate
rows:**

```
MWV   Wind Speed and Angle (Relative)   1Hz
MWV   Wind Speed and Angle (True)       1Hz
MWD   Wind Direction and Speed          1Hz
```

— *GoFree Tier 1 Networking Specification*, §4.7

That is a deliberate enumeration of both reference frames, not an accident of
formatting: every other sentence appears once. Combined with `MWD` (which is
*by definition* true wind — it has no apparent form), the stream carries the
full true-wind picture:

- `MWV,...,T,...` → **TWA** (angle off the bow) + **TWS**
- `MWD` → **TWD** (compass direction) + **TWS**
- `MWV,...,R,...` → AWA + AWS

**So the app does not need to derive true wind from apparent + boat speed +
heading.** Ingest `MWV` with the `T` flag, fold the 0–359° bow-relative angle
into SailPlan's 0–180°-plus-tack convention, and that's TWA. Take TWS from the
same sentence. `MWD` is a cross-check and gives TWD for free.

### The caveats, which are real

1. **The plotter is relaying, not necessarily originating.** Whether `MWV,T`
   carries useful numbers depends on *something* on the NMEA 2000 bus computing
   true wind — normally the wind instrument's processor (H5000 CPU, Triton²,
   WS310 etc.), which does it properly with heel and upwash correction. The
   Zeus 3 can also compute it itself; the installation manual refers to "the
   apparent and **calculated** wind" in the rotating-mast section (p. 24),
   confirming the MFD derives wind data. But if the boat has no boat-speed
   source and no heading source, true wind cannot be computed by anyone, and
   the `MWV,T` field may be empty or the sentence absent.
2. **True wind can be water-referenced or ground-referenced.** NMEA 2000's wind
   PGN (130306) distinguishes "True (boat referenced)", "True (water
   referenced)" and "True (ground referenced)"; NMEA 0183's `MWV` has only one
   `T` flag and cannot express which. For polars you want the
   **water-referenced** flavour (computed from STW), because a ground-referenced
   true wind bakes in tidal current and will systematically skew a polar in any
   tideway. **Which one the Zeus emits under the `T` flag is not documented and
   I could not determine it.** This is on the verify list, and it may need a
   sanity check against the boat's tide rather than a menu setting.
3. **Local calibration is not shared.** The Zeus3 manual warns that boat-speed
   and other offsets entered on the plotter "will ONLY be applied locally to
   this unit. Other devices on the network will not have these offsets applied"
   (p. 27). Whether the 0183-over-Ethernet stream carries the plotter's locally
   calibrated values or the raw bus values is not stated. Same question applies
   to *Damping*. Both feed straight into `map.md`'s "Instrument calibration"
   risk.

**Recommendation:** parse and log `MWV,R`, `MWV,T` *and* `MWD`. Derive polars
from `MWV,T`. Keep the apparent values because (a) they let a later ticket
re-derive true wind independently if the instrument's trig turns out to be
suspect, and (b) they cost nothing given the raw log is kept verbatim anyway.

---

## 5. Update rate and log sizing

### Per sentence type

Per the Tier 1 table in §3(a): `HDG` 10 Hz, `GGA` and `GLL` 5 Hz, **everything
else 1 Hz** — including every sentence this feature actually needs.

Corroborating from a different primary angle: the Zeus 3 manual's *NMEA0183
Output Sentences* dialog screenshot displays a live rate footer reading
**"Output rate 1.0Hz, HDG 9Hz"** for the serial port with the default selection.
The same 1 Hz baseline with heading roughly an order of magnitude faster shows
up in both places, which is reassuring. (The serial rate is baud-limited and
falls as you enable more sentences — "The less sentences that are selected, the
higher the output rate of the enabled sentences" — but the Ethernet stream has
no such bandwidth constraint, so the Tier 1 rates should hold there.)

The Zeus 3's internal GPS is a 10 Hz receiver (*Technical specifications*,
p. 49), but that speed does not reach the 0183 stream — `GGA`/`GLL` are capped
at 5 Hz and the SOG/COG carriers `VTG`/`RMC` at 1 Hz.

### Total, and what a race costs

Estimated from the documented rates and typical sentence lengths — **this is my
arithmetic, not a quoted figure**:

| Group | Rate × size | ≈ B/s |
| --- | --- | --- |
| `GGA` 5 Hz × ~80 B | | 400 |
| `GLL` 5 Hz × ~50 B | | 250 |
| `HDG` 10 Hz × ~35 B | | 350 |
| `GSA` + `GSV` 1 Hz (multi-sentence) | | ~350 |
| Wind: `MWV`×2, `MWD`, `VPW` @1 Hz | | ~125 |
| Water: `VHW` `DBT` `DPT` `MTW` `VLW` @1 Hz | | ~175 |
| `VTG` `RMC` `ZDA` @1 Hz | | ~160 |
| Nav suite (`AAM` `APB` `BOD` `BWC` `BWR` `RMB` `XTE`) @1 Hz — only while navigating a route | | ~385 |
| `XDR` @1 Hz | | ~70 |
| AIS `VDM`/`VDO` — highly variable with traffic | | 60–400 |
| **Total** | | **≈ 2.3–2.7 kB/s** |

That is:

- **~8–10 MB per hour** of raw text
- **~25–30 MB for a 3-hour race**
- **gzip ≈ 10:1** on this kind of repetitive ASCII ⇒ ~3 MB archived

Comfortably fine for `expo-file-system`, and it confirms founding decision 2
(raw stream to a file, never the DB) was the right call — 30 MB of text is
nothing as a file and unpleasant as SQLite rows.

### What this settles for `05`

Since **all** polar inputs arrive at exactly 1 Hz, "capture at native rate" and
"capture at 1 Hz" are the same decision for TWA/TWS/STW/SOG. There is no
higher-rate wind or boat-speed data being thrown away. The normalised sample
table can be 1 Hz without qualification; the raw log preserves the 5/10 Hz
position and heading in case a later ticket wants them.

Rough sample-table sizing at 1 Hz: 3 hours × 3600 = ~10 800 rows per race, which
matches `map.md`'s "~500 KB per race" estimate.

**Caveat on the rate table:** the GoFree Tier 1 spec's PDF metadata dates it to
2013 (last modified on Navico's CDN in 2016), and it references NSS 2.0/2.5-era
products. The Zeus 3 shipped in 2017. I found **no newer published rate table**.
The rates are therefore the documented platform behaviour, not a Zeus
3-specific measurement, and the actual observed rates should be measured on the
boat.

---

## 6. Configuration — what must be enabled on the plotter

**Best current understanding: almost nothing.** The 0183-over-Ethernet server
appears to be always on, and the only real setup is the WiFi mode.

### The steps

1. **Put the internal wireless in Access Point mode.**
   *Settings → Wireless → Wireless devices → (select) Internal Wireless → Mode →
   Access Point.*
   If the plotter is currently joined to a hotspot it is in Client mode;
   disconnecting from the hotspot flips it back to Access Point automatically.
2. **Read the SSID and network key.** Same dialog — *Network Name (SSID)* and
   *Network Key* are only visible/editable in Access Point mode. Default SSID
   looks like `GoFree wireless xxxx`. Key must be ≥ 8 characters.
3. **Read the IP address and port.**
   *Settings → Network → NMEA0183 → Ethernet* → shows *IP address*, *MAC
   address*, *Port*.
4. **Join that SSID from the phone and open a TCP socket** to that IP:port.

Steps 1–2 are from the *Zeus3 Installation Manual* p. 37 and the *Operator
Manual* p. 104–106; step 3 is p. 40 of the Installation Manual (and matches the
OpenCPN community how-to exactly).

### What is *not* required (and why I believe that)

- **No "GoFree" mode to turn on.** GoFree is Navico's brand for the wireless
  feature set, not a switch. The GoFree *Shop* and GoFree *Link* app are
  separate things and are irrelevant here — the app does not need the GoFree
  Link app installed or a GoFree account.
- **The "Serial output" checkbox is almost certainly irrelevant.** In the
  Zeus 3 manual's *NMEA0183* menu screenshot (p. 39), *Serial output* is
  **unchecked** (i.e. off by default) and *Serial output sentences…* is greyed
  out as a consequence — yet the *Ethernet* entry directly below is **not**
  greyed out. Both the Zeus 3 and Zeus3S manuals document *Serial output* as
  controlling "whether the data is output via **Tx lines**", i.e. the physical
  wire, and describe the Ethernet/WiFi output in a separate section with no
  enable control. The Ethernet dialog itself shows only three read-only values
  and offers no sentence picker.

  **Therefore the Ethernet stream is independent of the serial settings and
  carries the fixed Tier 1 sentence set.** This is an inference from manual
  layout and screenshots, not an explicit statement — it is the single most
  important thing on the verify list, because if it's wrong, someone has to tick
  boxes on the plotter before every recording.

  Working against this inference: the Operator Manual's diagnostics section says
  "All **serial output sentences** sent over the NMEA TCP connection are logged
  to an internal file" (p. 132), which loosely couples the two vocabularies.
  I read that as sloppy phrasing rather than evidence of coupling, but it is why
  I'm calling this medium confidence rather than high.
- **No password, no pairing, no token.** *"No security is required to receive
  the data."* (*Tier 1 spec*, §3.) The WiFi network key is the only credential.
- **No two-way handshake.** *"Two way communication is not currently supported.
  Data transmitted by mobile devices to the MFDs will be ignored."* (§4.4.) The
  app opens the socket and reads; it never writes. That's a simplification —
  and also means the app cannot request a higher rate or a different sentence
  set.

### Conflicting claim, addressed

Several search results and forum posts assert flatly that *"the Wi-Fi module on
the Zeus 2, 3, 3s, and S do not send NMEA data."* **I believe this is wrong as a
general statement**, on the strength of the primary manuals:

- Zeus 3 IM p. 40: "NMEA 0183 data stream is also output over ethernet, which is
  made available to tablet devices and PCs, **via the internal wireless**."
- Zeus3S IM p. 39: "The NMEA 0183 data stream is output and made available to
  tablet devices and PCs, **via WiFi or Ethernet connection**."

Both explicitly name wireless. Other community reports directly contradict the
negative claim ("NOS plotters such as Zeus will put out a very good NMEA0183
stream over TCP on port 10110"; "if you connect a PC on port 10110 to the Zeus
IP you can stream all the data on the N2K bus"). My best guess at the origin of
the negative claim is confusion with GoFree *Link* (screen mirroring, which is a
different service) or with a specific firmware regression. **But I cannot rule
out that a particular software revision broke or removed it**, and that is
precisely the kind of thing the boat visit exists to settle.

---

## Must verify on the boat (`04`)

Ordered by how much damage a wrong assumption does. Ideally all of these get
answered in a single visit with a laptop or phone running a raw TCP dump — one
capture of a few minutes of the unfiltered stream answers most of them at once.

1. **Does a TCP connection to the plotter over its own WiFi actually deliver
   sentences at all?** The one claim that would invalidate the whole approach.
   Capture the raw stream verbatim and keep it — it becomes the fixture for the
   `12` simulator.
2. **The real IP and port.** Read *Settings → Network → NMEA0183 → Ethernet* and
   photograph it. Confirm whether it is 10110.
3. **Does the phone get a working IP when it joins the plotter's AP?** The
   manuals conflict on DHCP: p. 38 says "The wireless module contains a DHCP
   server that allocates IP addresses for all the MFDs", while p. 37 says "The
   internal modules do not act as a DHCP server." If the internal AP does not
   serve DHCP, Android will end up with a link-local address and the connection
   will fail without an obvious cause. Check the phone's assigned IP.
4. **Is `MWV` present with the `T` reference, and is it populated?** Grep the
   raw capture for `MWV` and confirm you see *both* `,R,` and `,T,` variants
   with non-empty speed/angle and status `A`. **This is the load-bearing
   assumption of the whole feature.** If only `,R,` appears, the app has to do
   apparent→true itself and the error budget changes materially.
5. **Is `MWD` present and populated?** Cross-check its TWS against `MWV,T`'s.
   They should agree; disagreement means something interesting about which
   reference frame is in use.
6. **Is `VHW` present with a non-empty speed field?** Boat speed through water
   is the other half of a polar. If the paddle wheel is dead or absent, `VHW`
   may be missing or zero, and polars would have to be built on SOG instead —
   a different (worse, tide-contaminated) feature.
7. **Is the `MWV,T` true wind water-referenced or ground-referenced?** Not
   settleable from documents. Practical test: record in a known tidal stream and
   see whether TWD swings with the tide, or compare `MWV,T` against a hand
   calculation from `MWV,R` + `VHW`. Matters for polar accuracy in any tideway.
8. **Does the "Serial output" checkbox affect the Ethernet stream?** Capture
   with it off (the default), then toggle it on and capture again, and diff the
   set of sentence types. If they differ, the recording procedure needs a
   plotter-configuration step and the app needs to detect missing sentences.
9. **Observed update rates.** Timestamp the capture and count sentences per type
   per second. Confirms or replaces the 2013-era Tier 1 rate table and finalises
   the `05` sampling decision on measured rather than documented numbers.
10. **Actual bytes/second**, to firm up the log-sizing and retention policy.
11. **Does the multicast discovery announcement arrive on `239.2.1.1:2052`?**
    If yes, auto-discovery is viable and the user never types an IP. If not,
    the app needs manual IP entry as the primary path, not the fallback.
12. **Does the stream still work with the plotter in Client mode** (both plotter
    and phone joined to the phone's hotspot)? If yes, the phone keeps mobile
    data during a race, which is strictly better. Undocumented either way.
13. **Which sentences beyond the core set actually appear** — specifically
    `RMC` (missing from the Zeus3S manual's table), `XDR` heel/trim, and
    `VPW`. All are free bonuses if present.
14. **Software version of the unit** (*About* dialog). Everything above is keyed
    to it, and it lets a future reader tell whether these findings still apply.
15. **What the wind source actually is** (*Settings → Network → Sources*) —
    H5000 CPU, Triton², masthead unit direct, etc. Determines who is computing
    true wind and how good it is.
16. **Whether plotter-side Damping and Calibration offsets appear in the
    stream.** Note the current damping/calibration settings so a later
    discrepancy is diagnosable.

---

## Sources

### Primary — B&G / Navico

- **Zeus3 Operator Manual + Zeus3 Installation Manual** (single combined PDF,
  English, software v1.0, 198 pp.) —
  <https://cache.tradeinn.com/web/pdf/manuales/eng_bandg_manu_zeus3.pdf>
  (mirror of B&G document; the manual is listed on B&G's own downloads page at
  <https://ww2.bandg.com/downloads-category/zeus3-chartplotters-manuals/>).
  Key pages used:
  - Installation Manual p. 37 — *Wireless devices*, Access Point vs Client mode,
    SSID / Network Key / Channel
  - Installation Manual p. 38 — *DHCP Probe*, *Simultaneous Client and Access
    Point operation*, start of *NMEA 0183 setup*
  - Installation Manual p. 39 — *Receive waypoint*, *Baud rate*; screenshot of
    the `NMEA0183` menu showing *Serial output* unchecked by default
  - Installation Manual p. 40 — *Serial Output Sentences* (screenshot with
    "Output rate 1.0Hz, HDG 9Hz" footer) and ***NMEA 0183 over Ethernet*
    (screenshot showing IP address, MAC address, and Port 10110)**
  - Installation Manual pp. 46–47 — NMEA 2000 PGN receive/transmit lists
    (incl. 130306 Wind Data, 128259 Speed Water Referenced, 127250 Vessel
    Heading, 129026 COG & SOG)
  - Installation Manual p. 48 — *NMEA 0183 supported sentences* (serial TX/RX
    tables)
  - Installation Manual p. 49 — Technical specifications (10 Hz GPS, internal
    802.11b/g/n, NMEA 0183 baud rates)
  - Installation Manual pp. 23–24 — GPS offsets, rotating mast compensation
    ("apparent and calculated wind"), data source selection
  - Installation Manual p. 27 — *Damping*, *Calibration* ("applied locally to
    this unit" only)
  - Operator Manual pp. 104–106 — *Wireless connection*, GoFree Link, *Wireless
    settings*
  - Operator Manual p. 132 — *NMEA Data logging* ("All serial output sentences
    sent over the NMEA TCP connection are logged to an internal file")
- **GoFree Tier 1 Networking Specification** (Navico, PDF metadata author
  "Navico", created 2013, hosted on Navico's own asset CDN) —
  <https://s3-eu-west-1.amazonaws.com/navicodigitalassets/AMER/GoFree/GoFreeTier1NetworkingSpecification.pdf>
  §2.1 UDP multicast discovery; §2.2 Bonjour; §3 Security; §4 TCP data
  transmission; §4.1 NMEA0183 v4.00; §4.4 no two-way; §4.5 one source per data
  type ("the same applies to the B&G Zeus"); §4.7 **supported sentences and
  output rates**; §4.8 FAQ / why not IEC61162-450.
- **GoFree Tier 2 toolkit** (Navico) —
  <https://s3-eu-west-1.amazonaws.com/navicodigitalassets/AMER/GoFree/GoFree+Tier+2+toolkit.pdf>
  Used only to corroborate the discovery mechanism (`239.2.1.1` port 2052, and
  legacy port 2050) via its C# sample. Tier 2 itself is a WebSocket/JSON API on
  port 443 and is **not** what this feature targets.
- **Zeus3S Installation Manual** (English, 988-12599 series, 51 pp.) —
  <https://www.pysystems.com/site/assets/files/3392/zeus_3s_16_m1.pdf>
  Used as the cross-model check. p. 39 *Ethernet/WiFi* ("output and made
  available to tablet devices and PCs, via WiFi or Ethernet connection");
  pp. 48–49 *NMEA 0183 supported sentences* table, which resolves the Zeus 3
  manual's `VHM` typo to `VHW` and adds `THS`.
  **Extrapolation flag:** the Zeus 3S is a later model on the same Navico
  platform. Where I use it, it is to disambiguate the Zeus 3 manual, never to
  assert Zeus 3 behaviour on its own.
- B&G Zeus 3 manuals index —
  <https://ww2.bandg.com/downloads-category/zeus3-chartplotters-manuals/>

### Primary — NMEA 0183 sentence reference

- **NMEA Revealed** (Eric S. Raymond / gpsd project) —
  <https://gpsd.gitlab.io/gpsd/NMEA.html>
  Field layouts for `MWV`, `MWD`, `VHW`, `VTG`, `RMC`, `HDG`, `GGA`, `VPW`.
- IANA service name registry — port 10110 is registered as `nmea-0183`.

### Corroboration only — community sources, explicitly flagged

These are **not** relied on for any claim above; each merely agrees with a
primary source. Per the ticket's warning, they are the usual suspects for wrong
port numbers.

- **OpenCPN project how-to for B&G chartplotters** (project documentation, but
  community-authored) —
  <https://opencpn.org/wiki/dokuwiki/lib/exe/fetch.php?media=opencpn:manual_basic:route_manager:zeus.pdf>
  "Determine the IP address of the B&G Chartplotter. Goto->Settings->Network->
  NMEA0183->Ethernet [...] Also note the Port number, 10110 which is the default
  for transmitting NMEA 183 sentences over a network." — Agrees with the Zeus 3
  manual screenshot on both the menu path and the port.
- **Panbo, "Navico GoFree, WiFi1 & the 0183 Link"** —
  <https://panbo.com/navico-gofree-wifi1-the-0183-link/>
  Context on what Tier 1 is and that it is open to any developer.
- **Panbo, "WiFi MFD's, Navico GoFree promises more than met"** —
  <https://panbo.com/wifi-mfds-navico-gofree-promises-more-than-met/>
- **stripydog, "NMEA-0183 over IP: The unwritten rules for programmers"** —
  <http://stripydog.blogspot.com/2015/03/nmea-0183-over-ip-unwritten-rules-for.html>
  Independent description of GoFree's Bonjour `_nmea-0183._tcp` and multicast
  `239.2.1.1:2052`; also the useful warning that 10110, while IANA-registered,
  is far from universal and should always be user-configurable.
- **Cruisers & Sailing Forums / Sailing Anarchy / SailNet threads** — mixed and
  partly contradictory. Some report Zeus units streaming happily on 10110;
  others assert the Zeus WiFi module "does not send NMEA data". The primary
  manuals support the former. Recorded here only because the contradiction is
  itself a reason to verify on the boat.
  - <https://www.cruisersforum.com/forums/f134/b-and-g-wifi-module-interfacing-to-opcpn-166187-2.html>
  - <https://forums.sailinganarchy.com/threads/what-component-do-i-need-to-access-b-g-raw-data.248540/>
  - <https://www.sailnet.com/threads/b-g-zeus-3s-native-nmea-0183-ingetgration.343254/>

### Things I looked for and could not find

- Any Navico document post-dating 2016 that restates the Tier 1 sentence set or
  output rates. The 2013 spec appears to be the most recent published version.
- Any statement, in any manual, of whether the Ethernet 0183 stream is filtered
  by the *Serial output sentences* selection.
- Any statement of which NMEA 2000 wind reference (boat- / water- /
  ground-referenced true wind) is mapped onto `MWV`'s `T` flag.
- Any statement of whether the TCP server is reachable when the plotter's
  internal wireless is in Client mode.
- A machine-readable copy of the standalone Zeus 3 Installation Manual from
  `manuals.bandg.com` (host does not resolve from this environment; the
  defender.com mirror returns HTML rather than the PDF). The combined
  Operator+Installation PDF used above covers the same content.
