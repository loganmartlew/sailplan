# 04 — Record this course: the raw log and the foreground service

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §2, §4, §11. User stories
13–18, 28–31, 83, 84.

**What to build:** The sailor taps `Record this course` on the course plan they
are already looking at, puts the phone in a pocket, sails a race, and comes back
to a complete, verbatim NMEA log on disk. Nothing is parsed yet and no sample
rows exist — but **the raw log is lossless**, so everything downstream can be
built later and replayed against this file.

**This is the spec's minimum useful build**, and the one thing worth having
before a first outing: connect → timestamped raw file → survive screen-off. A
first race that goes wrong in every other respect still costs nothing.

**Blocked by:** `02`, `03`.

**Status:** done

- [x] The course-plan results screen offers `Record this course` when the active
      profile has plotter setup
- [x] With no plotter setup, that control is replaced by **Set up plotter**,
      deep-linked to the boat-profile detail screen's Plotter connection section;
      completing setup returns to the course plan
- [x] The socket is always opened with **`interface: 'wifi'`** — the mechanism for
      unvalidated boat WiFi, never a user-facing setting
- [x] **Raw-first, parse-second**: the raw log opens the instant the socket
      connects, in app document storage, in a dedicated directory with a
      predictable session-based filename. **Never the Android-reclaimable cache
      directory**
- [x] Recording runs in an Android foreground service of type **`connectedDevice`**
      — never `dataSync`, which Android 15 caps at 6 h per 24 h.
      `react-native-background-actions@4.1.0` per `13`, with
      `plugins/withNmeaForegroundService.js` merging
      `foregroundServiceType="connectedDevice"` and `stopWithTask="false"` onto
      the library's service. Verified in the built merged manifest
- [x] The pipeline is driven entirely off the socket's `data` event.
      **No JS timer sits anywhere on the capture path** — the service task is a
      promise that parks until Stop, not a loop
- [x] Recording survives the screen off, the phone pocketed, deep Doze and the
      restricted standby bucket for a race-length run — **measured in MT5, and
      the foreground service alone was not enough.** In deep Doze with no
      battery-optimisation exemption, Android destroys the socket at
      **2 m 43 s** (`Destroyed live tcp sockets for uids={[10000, 2147483647]}`)
      while the process, the `connectedDevice` service and the notification all
      stay up — and the recording bar goes on showing a healthy ticking timer
      for another 35 minutes. With the exemption granted: 13.7 min and still
      flowing, largest gap 0.2 s. **A wake lock keeps the CPU alive; it does not
      exempt the app from Doze's *network* rules.** Satisfied by the exemption
      item below
- [x] Before the socket opens, the sailor is asked **once** to exempt SailPlan
      from battery optimisation (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, merged
      by `plugins/withNmeaForegroundService.js`). Asked alongside the
      notification permission and for the same reason — not mid-recording.
      **Never blocks the start:** a declined exemption degrades the recording
      rather than preventing it. **Known gap:** whether the sailor actually
      tapped Allow cannot be read from JS without a local Expo module, so the
      app records only that it asked. Until `08` adds detection, an exemption
      declined by accident is silent
- [x] A `captureSession` row is created with the boat profile, the course link,
      `startedAt`, `rawLogPath` and `status: 'active'`
- [x] The notification is **status-only**; Stop ends the session cleanly
      (`status: 'ended'`, `endedAt` set). **Deviation:** RNBA's notification
      supports no action buttons, only a tap target. Tapping opens the app via
      `linkingURI`, where the capture layer's Stop sits above the tab bar and is
      reachable from any screen. A literal notification action needs either a
      local Expo module or `06`'s richer notification — decide there
- [x] A failed connection leaves the sailor on the course plan with **Retry**,
      **Open Wi-Fi settings** and **Plotter setup**, and creates **no** session
      and no half-formed recording
- [x] Failure copy distinguishes _not on boat WiFi_ from _on WiFi, plotter not
      found_, and may tell a fresh install to accept Android's **stay connected**
      prompt. **Was broken and is now fixed:** `connectFailureReason` matched
      `timed out`/`timeout` but not **`ETIMEDOUT`** — no space, and a `D`
      between `TIME` and `OUT` — so every real timeout, which is exactly the
      not-on-boat-WiFi case `13` measured at ~31 s, was classified `refused` and
      told the sailor to go and check the plotter's address. The unit test
      missed it by asserting on `'Connection timed out'`, the string this module
      generates itself, rather than the one the socket emits
- [x] The ~31 s no-route failure surfaces without the UI looking hung
- [x] `app.config.js` sets no explicit `targetSdkVersion` — Expo SDK 55 targets API 36 at build time
- [x] Verify on hardware over the repository's hotspot rig, including the
      no-internet WiFi trap. **Verified in MT5**, and two pieces of folklore in
      the original wording were wrong:
      - **It does not need a fresh install.** Forgetting the network resets it;
        the device's own wifi log shows the config removed and recreated, with
        the prompt reappearing. `hotspot.sh`'s "forget the network to reset it"
        was right all along
      - **The trap is governed by `network_avoid_bad_wifi`, not by tapping
        anything.** With it at `0` — this phone's default — Android keeps an
        unvalidated Wi-Fi as the *default route*, so a socket to the plotter
        succeeds with or without `interface: 'wifi'` and the test is vacuous.
        Set it to `1` and the default route moves to mobile, which is the real
        trap; the app then connects only because of `interface: 'wifi'`. **This
        makes the trap deterministic**, which `13` believed impossible

## Notes

**Code review fixes, after the checklist was first ticked.** Four of these were
this ticket's own promises not holding:

- **`stop()` latched a `stopping` flag before its first `await` and never reset
  it.** A stop that threw rejected, the store kept the handle for a retry as
  designed — and the retry hit the latch and resolved without doing anything, so
  the recording vanished from the UI while the session stayed `active`, the
  socket stayed attached and the `connectedDevice` service kept running. Now
  idempotent by sharing the in-flight promise, which is retryable. Regression
  test covers both halves
- **The raw log was not lossless.** Every Buffer off the socket was run through
  `chunk.toString()`, decoding as UTF-8 and replacing any byte that is not valid
  UTF-8 with U+FFFD — line noise, a half-received sentence, a proprietary
  sentence carrying high bytes, which is exactly the evidence this file exists
  to hold. `File.write` takes a `Uint8Array`, so chunks now reach the log as
  bytes. `07`'s diagnostics counted UTF-16 code units as bytes for the same
  reason
- **The `Set up plotter` fallback was ticked but not built.** The deep-link and
  the `returnToPlan` round trip existed and were reachable only from the
  *failure* dialog, so a first-run sailor with no plotter setup saw nothing at
  all on the course plan. Now built
- **A denied notification permission blocked recording permanently.** This
  contradicted both the plugin's own comment and the exemption rule two items
  above: a `connectedDevice` service starts fine without `POST_NOTIFICATIONS`
  and only the drawer notification is lost. It was also unrecoverable — Android
  answers with `never_ask_again` after two denials, so the copy telling the
  sailor to "retry and allow the prompt" described a dialog that would never
  appear again. Recording now degrades instead, the
  `notification-permission-denied` reason is gone, and the Plotter connection
  section carries routes to both the notification and the battery-optimisation
  system screens — closing the "declined by accident is silent" gap above for
  the exemption too, ahead of `08`'s detection
- Also: `endOrphanedCaptureSessions` ended only the first orphan;
  `captureFailureMessage` blamed the plotter's address for any error it could
  not classify; a failed plotter-setup save was indistinguishable from a
  successful one and still navigated back to the plan

**Spec §4 vs. this ticket on when the session row is created.** §4 says
`Record this course` "connects, waits for valid NMEA anchor data, and only then
creates the capture session"; this ticket's checklist creates the row on
connect. §2 resolves the file half ("raw-first... never the file") but not the
row. As built, the row is created on connect, per this ticket — there is no
parser here to detect an anchor with. **`05` should either tighten this to §4 or
amend §4.**

**The capture layer moved out of the course-plan screen.** Per spec §1 it is
chrome above the tab navigator, so the recording bar renders through the `Tabs`
`tabBar` prop. `06` replaces `CaptureRecordingBar` with the full strip.
