# 09 — Automatic GoFree discovery

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §4. User stories 2, 3, 7, 8,
11, 12.

**What to build:** The sailor never has to find an IP address on a chartplotter
menu. SailPlan listens for the plotter announcing itself and lists what it finds
by name and model, with the address as secondary detail — so the sailor
recognises their own plotter rather than decoding a list of hosts. When DHCP
moves the plotter, recording follows it. When two boats' instruments are both on
the network, SailPlan asks rather than guessing.

Automatic mode is the default; manual (`03`) stays a first-class path and is
never silently replaced.

**Blocked by:** `03`, `08` — each reconnect attempt listens for a fresh
announcement before falling back to the cached endpoint, so the retry ladder must
exist first.

**Status:** ready-for-agent

- [ ] Listens to GoFree UDP multicast `239.2.1.1:2052` (JSON, 1 Hz), holding a
      `MulticastLock`
- [ ] Setup lists each advertised NMEA source by **name and model**, address as
      secondary detail
- [ ] Stores the selected source's name and model, plus its last endpoint **as a
      cache**; a freshly announced endpoint is authoritative, because GoFree
      treats the port as dynamic
- [ ] The announcement carries no durable serial or MAC, so: **exactly one match
      reconnects silently; several matches require the sailor to choose**
- [ ] An ambiguous automatic match **never switches source in the background** —
      it keeps trying the last endpoint, marks the connection **Needs attention**,
      and offers selection if the app is opened
- [ ] In automatic mode each retry attempt listens for a fresh announcement
      before falling back to the cached endpoint; manual mode retries only its
      fixed endpoint
- [ ] Discovery never silently replaces a pinned manual address
- [ ] A route from the failure state straight to Android's WiFi settings and
      back, resuming discovery on return. SailPlan still never joins or switches
      WiFi, stores credentials, or mentions mobile data
- [ ] `nmea-sim` gains a GoFree announcement emitter producing the documented
      1 Hz JSON, able to emit multiple and ambiguous sources and a changed port
- [ ] Verified against the simulator: a single source connecting silently, two
      matching sources prompting, and a port change mid-session being followed
