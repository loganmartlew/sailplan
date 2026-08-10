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

**Status:** ready-for-agent

- [ ] The course-plan results screen offers `Record this course` when the active
      profile has plotter setup
- [ ] With no plotter setup, that control is replaced by **Set up plotter**,
      deep-linked to the boat-profile detail screen's Plotter connection section;
      completing setup returns to the course plan
- [ ] The socket is always opened with **`interface: 'wifi'`** — the mechanism for
      unvalidated boat WiFi, never a user-facing setting
- [ ] **Raw-first, parse-second**: the raw log opens the instant the socket
      connects, in app document storage, in a dedicated directory with a
      predictable session-based filename. **Never the Android-reclaimable cache
      directory**
- [ ] Recording runs in an Android foreground service of type **`connectedDevice`**
      — never `dataSync`, which Android 15 caps at 6 h per 24 h
- [ ] The pipeline is driven entirely off the socket's `data` event.
      **No JS timer sits anywhere on the capture path**
- [ ] Recording survives the screen off, the phone pocketed, deep Doze and the
      restricted standby bucket for a race-length run
- [ ] A `captureSession` row is created with the boat profile, the course link,
      `startedAt`, `rawLogPath` and `status: 'active'`
- [ ] The notification is **status-only** with **Stop** as its single action;
      Stop ends the session cleanly (`status: 'ended'`, `endedAt` set)
- [ ] A failed connection leaves the sailor on the course plan with **Retry**,
      **Open Wi-Fi settings** and **Plotter setup**, and creates **no** session
      and no half-formed recording
- [ ] Failure copy distinguishes *not on boat WiFi* from *on WiFi, plotter not
      found*, and may tell a fresh install to accept Android's **stay connected**
      prompt
- [ ] The ~31 s no-route failure surfaces without the UI looking hung
- [ ] `app.config.js` sets no explicit `targetSdkVersion` — confirm what Expo SDK
      55 targets at prebuild time
- [ ] Verified on hardware over the repository's hotspot rig, including the
      no-internet WiFi trap (needs a fresh install — a phone whose user once
      tapped **stay connected** permanently stops reproducing it)
