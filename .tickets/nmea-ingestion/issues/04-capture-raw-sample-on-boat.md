# 04 — Dockside verification: does the wire behave the way `01` says?

Type: task
Status: open
Blocked by: 01
Map: [map.md](../map.md)

## Question

Get **a real raw capture off the actual Zeus 3, from the dock, in 30 minutes**,
and answer everything that could invalidate a build.

This ticket was originally "get a sample off the boat" — one exhaustive visit
covering all 24 verify items, written when boat access was assumed to be rare
and undifferentiated. It has been **re-cut into two**, because access turned out
to have two very different shapes:

- **`04` (this ticket) — 30 minutes at the dock, today or Wednesday.** Cannot
  leave the berth. Covers the **go/no-go set**: everything that would waste the
  build week if it turned out false.
- **[`21` — race-day capture](21-race-day-capture.md) — Saturday.** A one-hour
  motor each way plus the race itself. Covers everything needing way on, plus
  the slow fiddly menu items there is no time for in 30 minutes.

The split is worth stating plainly: **the dock answers "can I build against
this?", Saturday answers "is what I built any good?"** Only the first is urgent.

### What the dock cannot answer

Three items, all of which `21` picks up:

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

### Before leaving the house

Everything in this section is desk work. None of it can be salvaged at the boat.

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
   *Testing against the simulator* below. Turning up at the boat with an
   untested script wastes the visit.

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

### Bonus: this is also Saturday's fallback logger

The same script, run in Termux with a wakelock, is the independent second
capture [`21`](21-race-day-capture.md) calls for. You will have already tested
it at the dock, which is exactly what you want from a fallback.

## The 30 minutes

The capture runs in the background while you do the menus. That overlap is the
only reason this fits.

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
   artifact of the trip** — get it running before anything else can eat the
   clock.
   ```sh
   termux-wake-lock
   python ~/capture.py <gateway-ip> 10110 ~/dock-$(date +%Y%m%dT%H%M).log
   ```
   Watch the sentence counter climb. If it stays at zero, that is `01` item 1
   failing and the rest of the visit changes character entirely — fall through
   to *Troubleshooting* below.

**T+5 to T+12 — the Serial-output toggle (`01` item 8).**

6. With ~3 minutes of capture banked, toggle the **Serial output** checkbox.
   Drop a marker into the log from a second Termux session (swipe from the left
   edge → *New session*):
   ```sh
   echo "### toggled serial output $(date +%s)" >> ~/dock-*.log
   ```
   Let it run 3 more minutes. The diff lives inside one timestamped file, so
   you can split it on the marker later — no second capture needed.

   If this gates the Ethernet stream, every recording needs a
   plotter-configuration step and the app must detect missing sentences.

**T+12 to T+25 — the menus, photographed, capture still running.**

7. *Settings → Network → Sources* → **the wind source** (`01` item 15,
   `17` item 1). H5000 CPU, Triton², or masthead direct. This one decides
   whether deriving true wind is permanently off the table.
8. **"Use SOG as boat speed"** and **"Use COG as heading"** (`17` item 2). They
   live in *different* menus — boat speed and compass. Photograph both. These
   are the difference between a usable polar and one with tide baked in.
9. **Damping values** for apparent wind, true wind, boat speed, heading
   (`01` item 16, `17` item 4).
10. **If an H5000 is present**: the TWA and TWS correction tables (`17` item 3).
    Is the −10 % TWS default there, or are they all zeros?
11. **Mast height above waterline** (`17` item 5). Tape on a halyard, or the
    rig spec if you have it. One number, and it makes the wind-gradient
    question answerable later without another trip. Do it at the dock — it is
    much worse underway.

**T+25 to T+30 — shutdown, and check before you leave.**

12. Stop the capture (Ctrl-C). **Verify it before stepping off the boat** —
    this is the last moment it is cheap to fix:
    ```sh
    wc -l ~/dock-*.log            # non-empty?
    tail -3 ~/dock-*.log          # timestamps present? sentences intact?
    grep -c 'MWV,T' ~/dock-*.log  # 01 item 4, the load-bearing assumption
    grep -c '###' ~/dock-*.log    # any unexpected reconnects?
    cp ~/dock-*.log ~/storage/shared/    # get it somewhere you can retrieve it
    ```
13. If `MWV,T` count is zero, **do not leave** — work the troubleshooting
    ladder. That single grep is the difference between a useful trip and a
    wasted one.

*(`01` item 11, the multicast discovery announcement, is deliberately not here
— see "The one item that does not port" above.)*

## Deliberately deferred to `21`

Not because they don't matter — because 30 minutes doesn't hold them and
Saturday's hour does:

- **`01` item 12 — plotter in Client mode** on the phone's hotspot. A menu
  change with a real risk of leaving the plotter misconfigured, and if it works
  it is strictly better (the phone keeps mobile data during a race). Do it on
  the motor out where there is time to put it back.
- **`01` item 5 — `MWD` cross-check against `MWV,T`** is *readable* dockside but
  only *meaningful* with way on.
- **`01` item 11 — multicast discovery.** Not a time problem but a tooling one:
  Termux cannot hold a `MulticastLock`, so a negative result would be
  uninterpretable. Moved to `21`, where the app's own discovery code tests it.

## Troubleshooting, if no bytes arrive

In order:

1. Is the Serial-output checkbox the gate? Tick it and retry — that is `01`
   item 8 answering itself the hard way.
2. Wrong port. `nmap -p 1-65535 <ip>` — GoFree also uses 2053.
3. Wrong host. If `ip route` gave a link-local address, the AP is not serving
   DHCP (`01` item 3, the manual contradiction) and you may need a static
   address on the plotter's subnet.
4. If the wireless module genuinely emits nothing, **that is the finding** —
   record it and stop. The forum posts were right, founding decision 1's
   transport is wrong, and the whole feature needs re-planning. Better to know
   in 30 minutes than after a build week.

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
- anything surprising

## Answer

<!-- filled on resolution -->
