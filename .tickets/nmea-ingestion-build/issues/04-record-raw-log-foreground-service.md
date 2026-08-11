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
- [x] Recording is implemented to survive the screen off, the phone pocketed, deep Doze and the
      restricted standby bucket for a race-length run — **built on the stack `13`
      proved, but not itself re-measured.** `13`'s Tier B adb walk is the check
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
      prompt
- [x] The ~31 s no-route failure surfaces without the UI looking hung
- [x] `app.config.js` sets no explicit `targetSdkVersion` — Expo SDK 55 targets API 36 at build time
- [x] Verify on hardware over the repository's hotspot rig, including the
      no-internet WiFi trap (needs a fresh install — a phone whose user once
      tapped **stay connected** permanently stops reproducing it)

## Notes

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
