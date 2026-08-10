# 04 — Wire verification: does the wire behave the way `01` says?

Type: task
Status: open
Blocked by: 01
Map: [map.md](../map.md)

## Question

Get **a real raw capture off the actual Zeus 3** and answer everything that
could invalidate a build.

This ticket has been re-cut **twice**. Originally it was "get a sample off the
boat" — one exhaustive visit covering all 24 verify items, written when boat
access was assumed to be rare and undifferentiated. It was then split into a
30-minute dockside visit (`04`) and a race day (`21`).

**Second re-cut — the separate dockside trip is gone.** Logan can no longer
count on reaching the boat before Saturday's race, so a standalone midweek
dockside visit is not something the plan may assume. `04` now has two halves
that run in **different places at different times**, and neither is a special
trip:

- **The desk half — this week, at home.** Termux, tooling, and `capture.py`
  shaken out against `nmea-sim`. This was always desk work; it was only ever
  filed under "the boat trip" because it was preparation *for* the trip. It
  loses nothing by the trip disappearing and **must still happen**.
- **The berth half — Saturday ~08:00, before slipping.** The four
  damage-ordered dominators, compressed to ~10–15 minutes in whatever window
  exists while the boat is prepped. Run at the berth, before the lines come
  off, so a bad answer is still actionable.

The old split's framing still holds, just relocated: **the berth answers "can I
record against this wire?", the day answers "is what I built any good?"** What
changed is that both now happen on the same morning, so the first answer arrives
*after* the build rather than before it — see
[What building blind costs](#what-building-blind-costs).

## What building blind costs

The map already licenses this: `04` has been a **confirmation step** since `14`
took the boat off the critical path, and after `08` there was no design decision
left waiting on it. Per FD2 and `05` the **raw log is lossless** — sample rows
are derived from the sentence stream — so the whole of Saturday survives in one
timestamped file, and parsing, leg detection and promotion can be replayed the
following week.

That bounds the downside well below "lost race", but it does not make it zero.
Four things that a midweek dock trip would have settled now land on race
morning, ranked by damage:

1. **The Serial-output checkbox (`01` item 8).** If it gates the Ethernet
   stream and it is unticked, you get **zero bytes** and find out at 08:00.
   Two minutes to fix *if you know the menu path* — so this ticket goes to the
   boat on your phone, readable offline. Cheapest insurance available.
2. **The endpoint is unknown until Saturday.** Manual host/port must be a
   first-class, **editable-on-the-day** field, exactly as `11` designed it —
   discovery must not be the only way in. `nmap -p 1-65535 <gateway>` in Termux
   is the backup; GoFree also uses 2053.
3. **`MWV,T` absent, or present with status `V`.** `05`'s anchor rule and
   `17`'s trust-the-instrument stance both rest on it. If it is missing, the
   race yields no polar points — but the raw log still preserves everything
   **provided raw bytes are written unconditionally**, which is why that is now
   a build requirement rather than a nicety (see below).
4. **No DHCP lease / link-local address (`01` item 3).** Setting a static IP on
   Android under time pressure is unpleasant. Worth rehearsing once at home so
   the toggle is findable.

### Two things the build must do because of this

Both are qualifications on `11`, carried here so the spec picks them up:

- **Raw-first, parse-second.** `11` decided that starting *"waits for valid
  NMEA data before opening the recording"*. Against an unverified wire that
  rule can refuse to record a race because the sentence set differs from `01`'s
  prediction. Open the raw file **the instant the socket connects**; validation
  gates the *sample* pipeline, not the *file*. Log unrecognised sentences
  rather than dropping them.
- **Soften the five-minute auto-end for this build.** `11`'s
  auto-end-at-last-valid-sample rule can silently terminate a race recording on
  a dropout that a dock visit would have characterised. Make it a warning, or a
  longer horizon, on the Saturday build.

Also carry `13`'s finding: its "samples thin under sustained backgrounding"
scare resolved as a **desk-rig artifact** (this box's own hostapd AP), but the
shape to watch for is **solid coverage then a hard cliff to total silence with
no socket error**. If that appears against the Zeus 3's own AP, it was not the
rig after all.

### What is now deliberately unanswered until Saturday

Not deferred for want of time — there is simply no window before the day:

- The **Serial-output A/B toggle** with 3 minutes of capture banked either
  side. You will find out whether the box needs ticking; you will not get a
  clean before/after diff.
- The **slow menu set** — wind source, "use SOG as boat speed" / "use COG as
  heading", damping values, H5000 correction tables, mast height. These are
  diagnostics for *interpreting* the data, not gates on building, and
  [`21`](21-race-day-capture.md)'s motor-out hour already holds them.

## What a boat at a berth cannot answer

Three items, all of which `21` picks up later the same day:

- **`01` item 7 — water- vs ground-referenced `MWV,T`.** Needs way on through a
  known tide. At a fixed berth STW and SOG are both zero, so the two frames
  coincide and the question is unanswerable by construction.
- **`17` item 7 (⭐) — the tack-to-tack calibration split.** Needs two tacks in
  steady breeze.
- **`01` item 6, the liveness half — is the paddlewheel alive?** You can confirm
  `VHW` *appears* with a non-empty field, but a dead paddlewheel and a
  stationary boat both read `0.00`. Resolves on Saturday within a minute of
  motoring.

One conditional exception: **if there is tide running past the berth**, the
paddlewheel may read non-zero while SOG stays at zero — which is both a
liveness test and a water-vs-ground discriminator. Worth ten seconds of looking
at `VHW` before assuming it has to wait.

## The gear: the phone alone is enough

**No laptop needed.** The Zenfone 10 on Android 15 with **Termux** covers every
item except one, and it is arguably *better* evidence than a laptop — the phone
is the actual target device, so its DHCP behaviour, its no-internet handling
and its routing are the ones that matter. A laptop getting a lease never proved
the phone would.

## The desk half — this week, at home

Everything in this section is desk work. None of it can be salvaged at the boat,
and **none of it was ever affected by losing the dock trip** — do it this week
regardless.

1. **Install Termux from [F-Droid](https://f-droid.org/packages/com.termux/) or
   the [GitHub releases](https://github.com/termux/termux-app/releases)** — the
   Play Store build is deprecated and years out of date.
2. Install the tools:
   ```sh
   pkg update && pkg install python nmap netcat-openbsd
   termux-setup-storage    # so captures can be copied off afterwards
   ```
3. **Take the wakelock from the command line, not the notification** — see
   *The wakelock* below.
4. **Get `capture.py` onto the phone and test it against the simulator** — see
   *Testing against the simulator* below. With no dockside rehearsal left, this
   script is the only capture path that will have been proven before race
   morning. Turning up with an untested one now risks the *race*, not a visit.

### The wakelock

Ignore the notification. Termux ships a command that does the same job and is
far easier to confirm:

```sh
command -v termux-wake-lock    # confirm it exists (it is in termux-tools, installed by default)
termux-wake-lock               # take it — run before starting a capture
termux-wake-unlock             # release it when done
```

**Why you are not seeing a notification.** Termux only posts one while a
session is actually running, and on Android 13+ it is hidden entirely unless
`POST_NOTIFICATIONS` was granted on first launch — a prompt that is easy to
dismiss. Even when granted, the session notification is low priority, so it
lands in the collapsed **Silent** section at the bottom of the shade rather
than up with your normal notifications, and its actions only appear once the
notification is expanded. If you want it back:
*Settings → Apps → Termux → Notifications* and enable the channels.

But you do not need it. `termux-wake-lock` is the same wakelock, and the test
below is how you confirm it is working — which is better evidence than a
notification saying it should be.

### Testing against the simulator

Both devices on your home WiFi. No hotspot rig needed — that is `13`'s problem,
not this one.

**On the Fedora box:**

```sh
cd nmea-sim
hostname -I                                # note the LAN IP, e.g. 192.168.1.42
ss -ltn | grep 10110                       # is the port free?
sudo firewall-cmd --add-port=10110/tcp     # firewalld blocks it otherwise; not permanent
node nmea-sim.js replay --rate 20 --loop   # real Navico data, forever
```

Two gotchas that will otherwise cost you twenty minutes:

- **firewalld blocks 10110 by default.** Without that `firewall-cmd` line the
  phone's connection times out with no useful error. It reverts on reboot; use
  `--remove-port=10110/tcp` to undo it sooner.
- **Something may already hold port 10110** on this machine — check with the
  `ss` line above. If so, kill it or run the simulator on `--port 10111` and
  point the phone there.

`replay` is the right mode for this test specifically because
[the GoFree log is already malformed](../../nmea-sim/README.md) — corrupt
`$SDVLW`, `-1.-3` in an `$IIXDR`, 331 over-length lines. If `capture.py` copes
with that, it will cope with the boat.

**Get the script onto the phone.** Simplest route, no ssh setup:

```sh
# Fedora, in .tickets/nmea-ingestion/
python3 -m http.server 8000
sudo firewall-cmd --add-port=8000/tcp
```
```sh
# Termux
curl -O http://192.168.1.42:8000/capture.py
```

**On the phone:**

```sh
termux-wake-lock
python capture.py 192.168.1.42 10110 ~/simtest.log
```

You should see `connected`, then a sentence counter climbing. Let it run a
minute, Ctrl-C, and check the output is what you expect:

```sh
head -3 ~/simtest.log     # ### markers, then `<epoch>.mmm $SDHDG,...` lines
wc -l ~/simtest.log       # ~1200 lines after a minute at --rate 20
```

A good first three lines look like this — millisecond timestamps, sentence
intact:

```
### connecting 1786320097.364
### connected 1786320097.371
1786320097.373 $SDHDG,158.5,,,21.5,E*0A
```

**Then the test that actually matters — the wakelock.** Start the capture
again, lock the phone, leave it five minutes, unlock, and confirm the counter
kept climbing the whole time (`wc -l` before and after). This is the one
failure mode you cannot detect at the boat: without a wakelock the capture
stalls on screen sleep and you find out when you get home. Run it once with
`termux-wake-lock` and, if you want to see the difference, once after
`termux-wake-unlock`.

Free the ports when you are done:
`sudo firewall-cmd --remove-port=10110/tcp --remove-port=8000/tcp`

### The capture script

**[`capture.py`](../capture.py)**, next to this ticket. Verified working against
`nmea-sim`'s replay of the real GoFree log.

Python rather than `nc | ts`, for three reasons: it avoids the moreutils and
netcat-variant lottery in Termux, it **reconnects automatically** so a blip
does not silently end the capture, and its `###` markers double as the session
connection log that `05` §5 wants.

Millisecond timestamps matter: `05`'s coalesce window is 250 ms, so
second-resolution stamps could not validate it.

### Multicast discovery is deliberately not tested — decided

`01` item 11, the GoFree announcement on `239.2.1.1:2052`, is **not on this
trip and not on the laptop, because the laptop is not coming.** Settled, not
deferred for want of time.

Android's WiFi stack drops multicast unless an app holds a `MulticastLock`, and
Termux cannot acquire one. So a phone test would be **the worst kind of test: a
negative result proves nothing** — "saw no announcement" and "the plotter does
not announce" would be indistinguishable. Do not run it and do not record a
result.

The consequence is small and already designed for. `11` decided
*discovery-first with an explicit manual mode*, where manual mode pins
host/port — and **manual mode is needed regardless**, so building it first
costs nothing and is the right order anyway. Saturday's capture (`21`) becomes
the real discovery test, run by app code that *can* hold a `MulticastLock`.

This decides whether the user ever has to type an IP, not whether the feature
works. Nothing on the map blocks on it.

Nothing on the map blocks on this. It decides whether the user ever has to type
an IP, not whether the feature works.

### Not a bonus any more: this *is* Saturday's fallback logger

The same script, run in Termux with a wakelock, is the independent second
capture [`21`](21-race-day-capture.md) calls for — and with the dockside
rehearsal gone it is no longer a nice-to-have. It is the **only** capture path
that will have been exercised against a real stream before race morning; the
app's own capture will be running for the first time ever, on a boat, in a
race. Started at the berth in step 5 above, it simply keeps running all day.

That is also why the desk half above is not optional: the simulator test *is*
the rehearsal now.

## The berth half — Saturday ~08:00, before slipping

**~10–15 minutes, in whatever window exists while the boat is prepped.** Not a
special trip; if the crew is ready early you get more, if not this is the
irreducible set. The capture starts as early as possible and keeps running for
the rest of the day, so everything after step 5 overlaps it.

Order matters here more than it did in the 30-minute version: these are the four
damage-ordered dominators and nothing else. If you are interrupted, you want to
have been interrupted **late** in this list.

**T+0 to T+5 — get connected and get bytes flowing.**

1. Plotter on. *About* → photograph the **software version** (`01` item 14).
   Everything below is keyed to it.
2. Join the plotter's WiFi from the phone. **Note whether Android warns that
   the network has no internet** — that observation *is* the `11` evidence and
   it is gone the moment you dismiss the prompt, so read it before you tap.
   Then **turn mobile data off** for the rest of the visit: this is `11`'s worst
   trap and it bites Termux exactly as it would bite the app — Android decides
   the plotter's AP is useless and routes to cellular, where the plotter does
   not exist. (`13` item 5 tests the real fix, `interface: 'wifi'`, on the desk
   rig; killing mobile data is just how you get today's capture done.)
3. *Settings → Wi-Fi → the plotter's network → Advanced*: photograph the
   **assigned IP** (real lease, or `169.254.x.x`? — `01` item 3) and the
   **gateway**, which is your plotter IP candidate. Read it here rather than
   with `ip route` in Termux — Android restricts `/proc/net` for non-root apps,
   so the shell is unreliable.
4. Read *Settings → Network → NMEA0183 → Ethernet* on the plotter and
   photograph it (`01` item 2). Confirm the port — 10110 is `01`'s prediction.
5. Open Termux and start the capture. **This is the single highest-value
   artifact of the morning** — get it running before anything else can eat the
   clock.
   ```sh
   termux-wake-lock
   python ~/capture.py <gateway-ip> 10110 ~/race-$(date +%Y%m%dT%H%M).log
   ```
   Watch the sentence counter climb. If it stays at zero, that is `01` item 1
   failing — fall through to *Troubleshooting* below, and do it **now**, at the
   berth, not once you have slipped.

**T+5 to T+8 — the load-bearing grep.**

6. With ~2 minutes banked, check the one assumption everything downstream rests
   on, **without stopping the capture** (second Termux session: swipe from the
   left edge → *New session*):
   ```sh
   grep -c 'MWV,T' ~/race-*.log   # 01 item 4 — must be non-zero
   grep -c 'VHW'   ~/race-*.log   # 05's other anchor
   tail -3 ~/race-*.log           # timestamps present? sentences intact?
   ```
   Non-zero `MWV,T` means the build's central assumption holds and the day is
   worth recording. Zero means `01` item 4 is wrong — the race still produces a
   raw log worth having, but no polar points, and you should say so in the
   answer rather than discovering it next week.

7. **The Serial-output checkbox (`01` item 8)** — only if step 6 came back
   zero, or nothing connected at all. Tick it, drop a marker
   (`echo "### toggled serial output $(date +%s)" >> ~/race-*.log`) and re-grep.
   The clean 3-minutes-either-side A/B the dock visit was going to give is gone;
   what remains is the fix, not the measurement. If ticking it is what made the
   stream appear, **that is the finding** — every recording needs a
   plotter-configuration step and the app must detect missing sentences.

**T+8 to T+15 — whatever the morning allows, in this order.**

Everything here is a *diagnostic for interpreting the data*, not a gate on
recording it, and all of it is also on [`21`](21-race-day-capture.md)'s
motor-out list. Take it now only if the boat is not ready; otherwise leave it —
you will have an unhurried hour under power.

8. **Mast height above waterline** (`17` item 5). The one genuinely easier at a
   berth than underway — tape on a halyard, or the rig spec. Take it now if
   there is any chance at all.
9. *Settings → Network → Sources* → **the wind source** (`01` item 15,
   `17` item 1). H5000 CPU, Triton², or masthead direct.
10. **"Use SOG as boat speed"** and **"Use COG as heading"** (`17` item 2), in
    *different* menus — boat speed and compass.
11. **Damping values**, and the H5000 correction tables if a CPU is present
    (`01` item 16, `17` items 3–4).

**Do not stop the capture.** Unlike the old dockside visit, this log runs on
into the day — it *is* `21`'s independent fallback stream. Leave
`termux-wake-lock` held and the script running, and verify it on the motor back
per `21`.

*(`01` item 11, the multicast discovery announcement, is deliberately not here
— see "Multicast discovery is deliberately not tested" above.)*

## Deliberately left to `21`

Not because they don't matter — because they need way on, or because the
morning is too tight to hold them and the motor out is not:

- **`01` item 12 — plotter in Client mode** on the phone's hotspot. A menu
  change with a real risk of leaving the plotter misconfigured, and if it works
  it is strictly better (the phone keeps mobile data during a race). Do it on
  the motor out where there is time to put it back.
- **`01` item 5 — `MWD` cross-check against `MWV,T`** is *readable* at a berth
  but only *meaningful* with way on.
- **`01` item 11 — multicast discovery.** Not a time problem but a tooling one:
  Termux cannot hold a `MulticastLock`, so a negative result would be
  uninterpretable. Handled in `21`, where the app's own discovery code tests it.
- **The whole slow menu set**, if the morning does not stretch to steps 8–11.

## Troubleshooting, if no bytes arrive

In order:

1. Is the Serial-output checkbox the gate? Tick it and retry — that is `01`
   item 8 answering itself the hard way.
2. Wrong port. `nmap -p 1-65535 <ip>` — GoFree also uses 2053.
3. Wrong host. If `ip route` gave a link-local address, the AP is not serving
   DHCP (`01` item 3, the manual contradiction) and you may need a static
   address on the plotter's subnet.
4. If the wireless module genuinely emits nothing, **that is the finding** —
   record it and go sailing. The forum posts were right, founding decision 1's
   transport is wrong, and the whole feature needs re-planning. This is the
   scenario the lost dock trip was insuring against: you find out after the
   build week rather than before it. The build is not wasted — nothing above the
   transport layer changes — but the week's schedule was.

## Resolution

Resolved when the capture file is committed under
`.tickets/nmea-ingestion/captures/` and the answer records:

- protocol and format observed, versus `01`'s prediction
- the exact endpoint and **how** it was found — that decides whether `11`'s
  discovery-first design survives
- sentence types present, and measured rate per type (`01` items 9, 13)
- bytes/second (`01` item 10), against `01`'s ~8–10 MB/hour estimate
- whether `MWV,T` is present and populated with status `A` (`01` item 4)
- whether the Serial-output checkbox changed the sentence set
- the wind source, and every photographed setting
- **which of the "build blind" risks above actually bit**, and what it cost —
  this is the evidence for whether skipping a dockside trip was the right call,
  and it is worth writing down while it is fresh

- anything surprising

`04` and [`21`](21-race-day-capture.md) now resolve **on the same day, from the
same log**. They stay separate tickets because they answer different questions —
`04` is "did the wire behave as `01` predicted", `21` is "is the boat's wind
system trustworthy and did the build hold up" — but expect to write both answers
in one sitting, and expect `04`'s to be the shorter of the two.

## Answer

<!-- filled on resolution -->
