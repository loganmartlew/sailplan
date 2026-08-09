# 04 — Get a real raw NMEA sample off the boat

Type: task
Status: open
Blocked by: 01
Map: [map.md](../map.md)

## Question

Get **a few minutes of actual sentences from the actual Zeus 3 on the actual
boat**, saved to a file.

This ticket is a **confirmation step, not a prerequisite**. Boat access is
scarce, so the map is deliberately wired so design work proceeds on `01`'s
documented behaviour plus `12`'s simulator, and this ticket validates or
corrects it afterwards. Resolving it may force revisions to `05`, `06` or `11`
— that's expected and cheaper than blocking on the water.

Because the trip is scarce, the checklist must be thorough enough that one
visit answers everything: a half-captured sample means waiting weeks for
another chance. It is also the only source of a **real** track for `12`'s
replay path.

This is manual work, done by Logan on the boat, not by an agent. `01` must
resolve first so the checklist knows what to look for.

**`01` has produced a 16-item, damage-ordered verify list** — see the "Must
verify on the boat" section of
[`research/01-zeus-3-nmea-output.md`](../research/01-zeus-3-nmea-output.md).
Work from it; the items below are the shape, that list is the content.

Four things dominate, in order of how much damage they do if wrong:

1. **Does the WiFi module emit NMEA at all?** Several forum posts claim the
   Zeus 2/3/3S wireless module does not. `01` judges that wrong — both manuals
   name wireless explicitly — but cannot exclude a firmware regression. If it's
   true, the entire feature needs a different transport. **Test this first;
   everything else is moot.**
2. **Does an Android phone get a real DHCP address on the plotter's AP?** The
   installation manual contradicts itself within two pages on whether the
   wireless module runs a DHCP server. A link-local address fails with no
   obvious cause.
3. **Is `MWV,T` populated, and is it water- or ground-referenced?** Not
   discoverable from a menu — needs a sanity check against a known tide.
   Ground-referenced true wind would skew every polar derived in a tideway.
4. **Does the "Serial output" checkbox gate the Ethernet stream?** If it does,
   boxes must be ticked on the plotter before every recording.

Produce a precise checklist covering:

1. **Get connected.** Enable whatever output mode `01` identified on the
   plotter. Join its WiFi (or the boat's shared network) from a laptop or
   phone. Note whether Android/the laptop complains about the network having
   no internet, and whether it silently falls back to cellular — this is a
   known trap and it feeds `11`.
2. **Find the endpoint.** Confirm the plotter's IP and port. Note *how* it was
   found (plotter menu, DHCP lease, mDNS/GoFree discovery, port scan) — that
   determines whether the app can discover it automatically or must ask.
3. **Dump the stream.** Capture a raw sample to a file — `nc <ip> <port> >
   sample.log` is enough, no app required. Get at least:
   - a few minutes **at rest / motoring**, and
   - if at all possible, a few minutes **sailing**, ideally through a tack, so
     the data shows what a manoeuvre looks like.
4. **Note the conditions.** Roughly what the wind and boat speed actually were,
   so the sentence values can be sanity-checked against reality — this is how
   a calibration problem would first show itself. If there is any tide running,
   note it: comparing `MWV,T` against it is the only way to tell whether the
   plotter's true wind is water- or ground-referenced.
5. **Timestamp every sentence as you capture.** Per `12`: a bare `nc` dump has
   no timing information, so replaying it later is guesswork. Prefer NMEA v4
   TAG blocks; failing that, pipe through something that prefixes a receive
   timestamp per line (`ts` from moreutils, or `awk`). **A capture without
   timestamps is worth substantially less** and this trip is expensive — get it
   right the first time.

### `17` added 8 more, and one of them is the highest-leverage item on the trip

From [`research/17-true-wind-derivation.md`](../research/17-true-wind-derivation.md) §7:

1. **What computes true wind on this boat?** *Settings → Network → Sources* →
   the wind source. If it's an **H5000 CPU**, `MWV,T` is corrected and deriving
   ourselves is off the table permanently. If it's a Triton2 or the MFD, it's
   naive trig and the cross-check should agree closely — itself a validation of
   our parser.
2. **Are "Use SOG as boat speed" and "Use COG as heading" enabled?**
   Photograph both. They are the difference between a usable polar and one with
   tide baked in, and they live in *different* menus (boat speed vs compass).
3. **If an H5000 is present: are the TWA and TWS correction tables populated or
   still at defaults?** A table of zeros means the corrections nominally exist
   but do nothing. Specifically: is the −10 % TWS default there?
4. **What are the damping values** for apparent wind, true wind, boat speed and
   heading? Needed to interpret any cross-check disagreement and to size `07`'s
   steady-state window.
5. **Mast height above waterline.** One tape measure, one number — makes the
   wind-gradient question answerable later without another trip.
6. **Is `XDR` heel populated and sane** (zero at the dock, signed correctly to
   starboard)? `01` listed `XDR` as a bonus; `17` makes it the input to two of
   the three reproducible corrections, and `05` now stores it on every row.
7. **⭐ Sail a tack-to-tack pair in steady breeze and record `MWV,T` TWD on each
   tack.** The tack-to-tack split **is** the calibration state of the whole wind
   system in one number: 3° well calibrated, 5–7° first-pass, 10° uncalibrated.
   Five minutes, and it sizes every TWA error in `17` for *this* boat.
8. **A run with known tide** — the practical discriminator for water- vs
   ground-referenced (item 3 in the damage-ordered list above).

Resolved when a raw sample file is committed somewhere in the repo (or
attached and its location recorded here) and the answer below records:

- protocol and format actually observed, versus what `01` predicted
- the exact endpoint and how it was discovered
- which sentence types appeared, and at what rate each
- whether true wind was present or only apparent
- anything surprising

## Answer

<!-- filled on resolution -->
