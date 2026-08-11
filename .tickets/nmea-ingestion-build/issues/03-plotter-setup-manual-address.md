# 03 — Plotter setup: manual address

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §4. User stories 1, 4, 5, 6, 10.

**What to build:** The sailor can tell SailPlan where their plotter is, at home,
the week before the race, with the plotter switched off. Setup lives on the boat
profile, so switching boats switches which plotter SailPlan expects. Manual
host/port ships first — per the `04` re-cut, multicast discovery cannot be
verified until race day, and manual mode is needed regardless.

There is **no boat-profile detail screen today** — `boatProfile` is a context, a
gate and a picker. This ticket creates one.

**Blocked by:** `02`.

**Status:** ready-for-human

- [x] A boat-profile detail screen exists and is reachable from the existing
      profile UI
- [x] It carries a **Plotter connection** section that pins a host and a port,
      stored as a `plotterSetup` row for that profile
- [x] Setup saves while the plotter is switched off; nothing about saving
      requires reachability
- [x] **Test connection** is offered and optional; the section shows `Not tested`
      or the last successful test time
- [x] `lastTestedAt` sits beside the setup and is never part of what makes it
      valid — **configured means the profile has a connection method, not that
      the plotter is reachable**
- [x] Switching the active boat profile switches which setup is shown
- [x] SailPlan never joins or switches WiFi, stores credentials, or mentions
      mobile data
- [ ] Verified on a device against `nmea-sim` on the desk: save with the
      simulator down, then Test connection with it up
