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

1. **Install Termux from [F-Droid](https://f-droid.org/packages/com.termux/) or
   the [GitHub releases](https://github.com/termux/termux-app/releases)** — the
   Play Store build is deprecated and years out of date. This is the one step
   that cannot be done at the boat if it goes wrong.
2. ```sh
   pkg update && pkg install python nmap netcat-openbsd
   termux-setup-storage    # so captures can be copied off afterwards
   ```
3. Save the capture script below to `~/capture.py` and **test it against the
   simulator on your desk** — `nmea-sim` is already built and listening.
   Turning up at the boat with an untested script wastes the visit.

### The capture script

Python rather than `nc | ts`, for three reasons: it avoids the moreutils and
netcat-variant lottery, it **reconnects automatically** so a blip doesn't end
the capture silently, and its `###` markers double as the session connection
log that `05` §5 wants.

```python
# ~/capture.py — usage: python capture.py <ip> <port> <outfile>
import socket, sys, time

host, port, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
n = 0
with open(out, "ab", buffering=0) as f:
    while True:
        try:
            f.write(f"### connecting {time.time():.3f}\n".encode())
            s = socket.create_connection((host, port), timeout=10)
            f.write(f"### connected {time.time():.3f}\n".encode())
            buf = b""
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    raise ConnectionError("peer closed")
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    f.write(f"{time.time():.3f} ".encode() + line.rstrip(b"\r") + b"\n")
                    n += 1
                    if n % 50 == 0:
                        print(f"\r{n} sentences", end="", flush=True)
        except KeyboardInterrupt:
            raise
        except Exception as e:
            f.write(f"### lost {time.time():.3f} {e}\n".encode())
            time.sleep(2)
```

Millisecond timestamps matter: `05`'s coalesce window is 250 ms, so
second-resolution stamps cannot validate it.

### Three phone-specific gotchas

1. **Acquire the Termux wakelock** — pull down the Termux notification and tap
   *Acquire wakelock* before starting the capture. Without it the capture can
   stall when the screen sleeps, and you will not notice until you get home.
2. **Turn mobile data off for the visit** — *after* noting whether Android
   prompts about the network having no internet. This is `11`'s worst trap and
   it will bite Termux exactly as it would bite the app: Android may decide the
   plotter's AP is unusable and route to cellular, where the plotter does not
   exist. Observe the prompt (that is the `11` evidence), then kill mobile data
   so the capture actually works. `13` item 5 tests the real fix
   (`interface: 'wifi'`) properly on the desk rig.
3. **Read the IP from Settings, not the shell.** Android restricts `/proc/net`
   for non-root apps, so `ip route` in Termux is unreliable. *Settings → Wi-Fi →
   the plotter's network → Advanced* shows your assigned IP (real lease, or
   `169.254.x.x`? — that is `01` item 3) and the **gateway, which is the
   plotter IP candidate**.

### The one item that does not port: multicast discovery

`01` item 11 — the GoFree announcement on `239.2.1.1:2052` — is the exception.
Android's WiFi stack drops multicast unless an app holds a `MulticastLock`, and
Termux cannot acquire one. `socat` may or may not see the announcement
depending on the driver, which makes it **the worst kind of test: a negative
result proves nothing.** "Saw no announcement" and "the plotter does not
announce" are indistinguishable.

Do not run it on the phone and record the result. Instead, pick one:

- **Take the laptop purely for this** — five minutes, one `socat` command. Only
  worth it if the laptop is coming anyway.
- **Leave it unverified, and build manual mode first.** This is the
  recommendation. `11` already decided *discovery-first with an explicit manual
  mode*, where manual mode pins host/port — and you need manual mode regardless.
  Building it first costs nothing, and the app's own discovery attempt on
  Saturday (`21`) becomes the real test, run by code that *can* hold a
  `MulticastLock`.

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
   the network has no internet** — that observation is the `11` evidence, and
   it is gone once you dismiss the prompt. Then turn **mobile data off**.
3. *Settings → Wi-Fi → the plotter's network → Advanced*: photograph the
   **assigned IP** (real lease, or `169.254.x.x`? — `01` item 3) and the
   **gateway**, which is your plotter IP candidate.
4. Read *Settings → Network → NMEA0183 → Ethernet* on the plotter and
   photograph it (`01` item 2). Confirm the port — 10110 is `01`'s prediction.
5. Start the capture in Termux, wakelock acquired. **This is the single
   highest-value artifact of the trip** — get it running before anything else
   can eat the clock.
   ```sh
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
