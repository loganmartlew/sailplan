# 11 — Connection UX: finding the plotter and staying on it

Type: grilling
Status: resolved
Blocked by: 02, 12
Note: decision complete; validate the Android behaviour in `13`.
Map: [map.md](../map.md)

## Question

Everything else assumes a working socket. This ticket owns getting one, and
the specific ways Android makes that annoying.

1. **Endpoint configuration.** `01` confirms discovery exists: UDP multicast
   `239.2.1.1:2052` (JSON, 1 Hz) and Bonjour `_nmea-0183._tcp`, with TCP on
   port **10110**. Critically, the GoFree Tier 1 spec treats the port as
   *dynamic and announced* — 10110 is a default, not a guarantee — which argues
   for supporting discovery rather than only a typed-in address. `12` found
   **kplex's `gofree.c` implements exactly this discovery**, so there's a
   working reference to read rather than deriving it from the spec. Decide:
   typed address, discovery, or discovery with manual override.
2. **Remembering it. — DECIDED BY `09`, confirm the UX only.** The endpoint is a
   **per-boat-profile value**, not a global setting and not per-session. Logan,
   resolving `09`: *"connection details (IP, port, device-name, NMEA version)
   should be stored against boat profile, so you can't start capture unless it's
   configured."*

   Two things this ticket still owns: **where that config is edited** (boat
   profile screen, presumably) and **the gating UX** — `09` puts the start
   control on the course plan, and with no endpoint on the active profile it is
   replaced by a "set up plotter" prompt. Also reconcile with question 1: if
   discovery works, a stored endpoint may be a cache rather than the source of
   truth, and DHCP churn is exactly the case that argues for discovery. Column
   shape goes to `08`.
3. **The no-internet WiFi trap — largely answered, confirm and decide the UX.**
   `02` and `12` reached the same conclusion independently: pass
   **`interface: 'wifi'`** when connecting with `react-native-tcp-socket`. `12`
   read `TcpSocketModule.java` and confirmed it calls
   `ConnectivityManager.requestNetwork` with `TRANSPORT_WIFI` while
   deliberately **not** requesting `NET_CAPABILITY_INTERNET` — precisely what
   matches an unvalidated network. `13` step 5 verifies it on hardware.

   What's left is UX, not mechanism: what does the app show when the phone is
   on the right WiFi but traffic is still going elsewhere, and does it need to
   say anything about mobile data at all? Note `12`'s finding that a user who
   taps **"stay connected"** on Android's no-internet prompt permanently hides
   the behaviour — so your own phone may stop reproducing a bug that still
   affects a fresh install.
4. **Reconnection.** Founding decision 6 requires auto-reconnect. What's the
   backoff, when does the app give up, and how does it distinguish "plotter
   rebooted" from "phone left the boat"?
5. **Failure that's visible.** A connection that dies silently mid-race is the
   worst failure mode here. Does the foreground-service notification change
   state? Does the phone vibrate? Getting this wrong costs a whole race of
   data — and you won't get that race back.
6. **Testing without a boat.** `12` settles the simulation approach — use it.
   In particular, the no-internet trap in question 3 should be reproducible
   with a phone hotspot that has mobile data off, so this ticket should not
   need boat access at all.

## Answer

**Discovery first, manual when deliberate; reconnect for five minutes, then
auto-end into a resumable recording.** A saved setup and a live connection are
different things throughout the UX.

### 1. Two explicit connection methods

Plotter setup belongs to the **boat profile** and is edited in a new boat-profile
detail screen:

- **Automatic discovery** (default) listens to GoFree UDP multicast
  `239.2.1.1:2052`. Setup lists each advertised NMEA source by name and model,
  with IP and port as secondary detail. The sailor selects one; SailPlan stores
  its name/model plus the last endpoint as a cache. A freshly announced port is
  authoritative because GoFree permits it to be dynamic.
- **Manual address** stores a fixed host and port. It is a real pin for
  simulators, non-GoFree gateways and unusual networks: discovery never silently
  replaces it.

The announcement has no durable serial or MAC identity. When exactly one source
matches the saved name/model, automatic mode may reconnect to it. When several
match, setup requires the sailor to select rather than guessing.

Saving is allowed while the plotter is offline. **Test connection** is offered
but optional; setup shows `Not tested` or the last successful test time. Thus
`configured` means the profile has a connection method, not that the plotter is
currently reachable. This distinction is part of the domain model, not merely
copy.

### 2. Profile and recording entry UX

The profile picker gains a route to a boat-profile detail screen containing a
**Plotter connection** section. On the course plan:

- with no setup, `Record this course` is replaced by **Set up plotter**, deep
  linked to that section; completing setup returns to the course plan;
- with setup, tapping **Record this course** first connects and waits for valid
  NMEA anchor data; only then is the recording created;
- failure leaves the sailor on the plan and offers **Retry**, **Open Wi-Fi
  settings**, and **Plotter setup**. No empty recording is created.

SailPlan does **not** join or switch WiFi, store WiFi credentials, or mention
mobile data. The sailor manages the network. SailPlan may open Android's WiFi
settings and resumes discovery when the user returns. The socket is always
bound with `interface: 'wifi'`; that is the mechanism for unvalidated boat WiFi,
not something the sailor must configure. Failure copy distinguishes `not on
boat WiFi` from `on WiFi, plotter not found` and may instruct a fresh Android
install to accept the system's **stay connected** prompt.

### 3. Reconnection and the terminal point

The app does not pretend it can distinguish a plotter reboot from the phone
leaving the boat. Both follow one policy, measured from the **last valid NMEA
anchor data**, so a connected-but-silent socket is covered too:

1. retry immediately, then after 1 s, 2 s, 5 s and 10 s;
2. retry every 15 s thereafter;
3. after five continuous minutes without valid data, auto-end the recording.

In automatic mode each attempt listens for a fresh announcement before falling
back to the cached endpoint. Manual mode retries only its fixed endpoint. An
ambiguous automatic match never causes a background source switch: continue
trying the last endpoint, mark the connection **Needs attention**, and offer
selection if the app is opened. Otherwise the normal five-minute end applies.

Recovery inside five minutes continues the same recording and preserves the
outage in the connection-event log. There are no manufactured empty sample
rows.

At five minutes, set the recording's end to its **last valid sample**, preserve
all captured data, stop the foreground service, and post `Recording ended —
plotter data lost for 5 minutes`. This avoids an indefinite service after the
instruments are deliberately turned off.

### 4. Failure is visible and audible

The capture layer already settled in `09` is the in-app source of truth:

- loss immediately greys live values and shows **Retrying** with the gap age;
- the foreground notification immediately changes to **Connection lost —
  retrying**;
- vibrate distinctly after 5 s and again after 60 s, but do not buzz repeatedly;
- recovery gives one short confirmation vibration;
- auto-end at five minutes gives one final vibration and replaces the foreground
  notification with the normal auto-end notification above.

This escalation applies to feed silence as well as socket close/reset.

### 5. Auto-ended recordings may be resumed contemporaneously

Auto-ending is not irreversible while the sailor is still in the capture
workflow. **Resume recording** appears only in the auto-end notification and on
the original course's plan screen. It disappears when the sailor dismisses the
notice, starts another recording, or confirms/promotes that recording's data —
whichever comes first. It is never offered later from recording history.

Resume first reconnects and waits for valid data. On success it reopens the
**same recording**, keeps the outage as a connection-event gap, and advances
the end time when capture later stops. On failure it remains auto-ended and
resumable. A recording stopped deliberately by the sailor cannot resume, and
recovery never starts a new recording automatically.

`08` owns the concrete persisted state needed to distinguish active,
deliberately ended, auto-ended/resumable and confirmed recordings.

### 6. Test without the boat

Use `nmea-sim` for clean streams, silence, FIN/RST and endpoint recovery, plus
the repository's hotspot rig for an unvalidated WiFi network. Automatic-mode
tests require the simulator (or a small companion) to emit the documented
1 Hz GoFree discovery JSON, including multiple/ambiguous sources and a changed
port. `13` remains the hardware validation for WiFi binding, notification,
vibration, screen-off reconnect and the five-minute service shutdown; boat
access is not on the critical path.
