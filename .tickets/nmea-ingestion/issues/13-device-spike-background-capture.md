# 13 — Device spike: prove the 3-hour screen-off capture on real hardware

Type: task
Status: open
Blocked by: 14
Map: [map.md](../map.md)

## Question

`02` passed the feasibility gate **on documentation**, and named this spike as
the condition for the verdict standing. Nothing in `02`'s recommended stack has
a published 3-hour screen-off report for this exact combination — the research
looked and found none. Until this runs, founding decision 6 rests on inference.

Build the smallest possible thing that proves it, on Logan's actual phone. This
is throwaway — it is not the feature.

Per `02`'s recommendation, spike with `react-native-background-actions@4.1.0`
first (fastest path to a running foreground service), then port to a local Expo
module. Stream from `14`'s simulator, not the boat.

Prove, in order of how much damage each does if it fails:

1. **A `connectedDevice` foreground service starts at all.** The app currently
   has **no** `FOREGROUND_SERVICE*` permissions in its manifest, so this needs
   the `app.config.js` plugin changes `02` specifies plus a prebuild. Confirm
   `dataSync` is *not* used — Android 15 caps it at 6 h/24 h and targetSdk 36
   gets no grace period.
2. **A TCP socket survives 3 hours with the screen off.** The failure mode is
   the cached-app freezer terminating sockets 10 s after the process is
   cached — so the test must be genuinely backgrounded and genuinely idle, not
   just dimmed.
3. **Writes keep landing.** SQLite rows continue to accumulate throughout, with
   no gap. Count them; don't eyeball it.
4. **Does `Choreographer` deliver frames with the display off?** `02`'s single
   most important unknown, unresolvable from documentation — the existence of
   the `react-native-background-timer` genre implies not, and field reports
   contradict each other. Test a `setInterval` alongside a native Kotlin tick
   and see which survives. **`05`'s sampling model depends on this answer.**
5. **`interface: 'wifi'` behaves as expected** against an access point with no
   internet, using `12`'s Fedora hotspot rig. Both `02` and `12` independently
   concluded this is the fix for `11`'s worst trap — confirm it.
6. **OEM battery management on this specific phone.** `02` calls this the real
   killer. Establish whether the service survives, whether
   `isIgnoringBatteryOptimizations()` needs to gate recording, and what the
   user-facing consequence is.
7. **Battery cost over 3 hours**, since a race day may involve more than one.
8. **Does `react-native-background-actions@4.1.0` even build on AGP 8.12?**
   `02` could not establish this. If it doesn't, skip straight to the local
   Expo module.

Resolved when the answer records: pass or fail per item, the actual stack that
worked, the `app.config.js` diff required, and — if anything failed — what it
means for founding decision 6.

> **Unblocked by `14`.** The rig exists: `nmea-sim/hotspot.sh up` brings up the
> access point on `10.42.0.1`, and `node nmea-sim.js generate --duration 10800`
> makes the three hours of stream item 3 needs. Two notes for whoever takes
> this:
>
> - `hotspot.sh up` and `hotspot.sh blackhole` are **untested end to end** —
>   they need `sudo` and a phone, which `14` had neither of. This ticket is
>   their first real run; expect to fix the script, and fix it in place.
> - For item 5 to mean anything the test phone must have **working mobile
>   data**, and must **not** have tapped "stay connected" on the no-internet
>   prompt for that SSID (the choice is sticky — forget the network to reset
>   it). The script prints both conditions when it starts.

## Answer

<!-- filled on resolution -->
