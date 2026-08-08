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

Resolved when a raw sample file is committed somewhere in the repo (or
attached and its location recorded here) and the answer below records:

- protocol and format actually observed, versus what `01` predicted
- the exact endpoint and how it was discovered
- which sentence types appeared, and at what rate each
- whether true wind was present or only apparent
- anything surprising

## Answer

<!-- filled on resolution -->
