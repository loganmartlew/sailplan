# 09 — The capture screen: the in-race surface

Type: prototype
Status: resolved
Blocked by: 02
Map: [map.md](../map.md)

## Question

The one screen that has to work **on a heeling boat, one-handed, possibly wet,
possibly in the dark, while racing**. Everything else in this feature is used
sitting down afterwards.

Prototype what it looks like and how it behaves.

1. **Declaring the sail.** Founding decision 4's assertion — *"we're on the #3
   right now"* — is the only thing you're expected to do during a race, and it
   must be near-zero effort. How is it presented? A row of large sail buttons
   (sails already carry a `color`, which is a gift here)? A single button
   opening a picker? What confirms the tap landed, given you won't be looking
   closely?
2. **Wrong taps.** Can an assertion be undone in the moment, or is correcting
   it purely a review-time job?
3. **Start and stop.** How does a session begin — explicit start, or does
   connecting start it? What prevents an accidental stop mid-race? Does it need
   a name up front, or can that wait until review?
4. **Connection state.** Connected, connecting, dropped-and-retrying,
   dead — how is each shown, and how loudly? A silently dead connection that
   records nothing for an hour is the worst outcome this feature has.
5. **Confidence that it's working.** What single glance tells you data is
   genuinely arriving? Live TWS/TWA readout, a sample counter, a rolling
   sparkline — enough to trust it without watching it.
6. **The notification.** `02` confirms a foreground service is required — of
   type **`connectedDevice`** — so a persistent notification is
   non-negotiable, not a design choice. That makes it a real surface worth
   designing rather than an artefact to minimise.

   What does it say? And can the sail assertion be made **from the
   notification itself** via action buttons, which would mean never unlocking
   the phone at all? Worth prototyping seriously, because it may be a better
   answer to question 1 than anything on the screen — and because the
   notification is the only part of this feature guaranteed to be visible
   while recording. Note the practical limit of roughly three action buttons,
   which may not cover a full sail wardrobe.
7. **Screen off.** The expected state is pocketed with the screen off. What's
   the flow to check on it and get back out again quickly?

Deliver a rough, throwaway artifact to react to — layout sketches or a
non-functional RN screen. Do not build the real thing.

## Answer

**The ticket's premise was wrong, and that is the finding.** There is no capture
screen. Logan, on seeing three variants of one: *"I still need to be able to
interact with the course plan while recording data. This is critical."* Capture
is a **layer over the app you are already using**, not a surface that owns the
screen. Q3 and Q7 largely dissolve — you never leave the app, so there is no
"getting back out".

Prototypes: `prototypes/09-capture-screen.html` (v1, the wrong premise — kept as
the evidence for the pivot) and `prototypes/09-capture-layer.html` (v2, three
capture layers rendered over a mock of the course-plan results screen). Branch
`prototype/09-capture-layer`.

### 1. The shape: a persistent instrument strip (v2 variant A)

While recording, a slim strip sits between the content and the tab bar, on
**every** screen. It carries, left to right: a connection dot, live **TWS** and
**TWA** in large mono digits, the last stamp with its age, and a `✚` target. The
whole strip is one touch target; tapping it opens the sail sheet.

Rejected: a floating stamp puck (v2 B) — zero layout cost, but it reduces "is
this working" to a green dot, and a frozen-but-connected feed looks identical to
a healthy one. That readout was the single most-liked thing across both rounds
and it is not worth trading for 54px.

Consequences for the build:

- **Nothing renders when not recording.** No collapsed strip, no residue, no
  placeholder. The app is exactly itself.
- **Scroll padding is a requirement, not a detail.** Every scrollable screen
  needs bottom inset equal to the strip's height while recording, or the strip
  permanently occludes the last leg card. Logan: *"we just need to make sure we
  can scroll the legs far enough to unblock them."*
- The strip is app chrome, so it belongs above the tab navigator, not inside
  any one screen.

### 2. Sail declaration: a **stamp**, not a state

This is the ticket's most consequential outcome and it **amends founding
decision 4**. Logan: *"I don't care about starting/stopping sails, just recording
a single point in time we had this sail up, so that later on similar
angles/speeds around the same time are assumed to be that sail too."*

- One tap on the strip → bottom sheet → one tap on a sail. **Two taps, ending in
  a stamp**: *this sail was up at this instant*. Nothing is ever turned off.
- The sheet is a 2-column grid of large colour-coded targets. **It scrolls.** 8
  is not the ceiling — Logan: *"it's entirely possible to have >8 ... scrolling
  within a bottom sheet is fine"*. The prototype ships 11 to prove the sheet
  does not re-layout past 8.
- Mis-taps are corrected by an **undo toast** (~9 s) and, failing that, at review
  time — `10` question 3 already owns the review-time path.
- The strip shows the **last stamp**, explicitly labelled as such, and its age
  turns amber past 15 minutes. With sparse stamping that nag is the only
  pressure keeping a session attributable.

**The load-bearing constraint on everything downstream** — Logan: *"that's fine
as long as it isn't being used for the current recorded points. If I forget to
stamp after a sail change for example."* A stamp is displayed as history and
must never be read as a claim about now. **A stamp does not propagate forward.**
Forgetting to stamp must produce *unattributed* samples, never *wrongly
attributed* ones. This is the exact opposite of founding decision 4's "an
assertion holds until the next one", and it is deliberate: silent
misattribution poisons a polar, an unattributed stretch merely wastes it.

The attribution rule itself — which samples a sparse stamp actually claims — is
**not this ticket's to decide**. Raised as `19`.

### 3. Start and stop (Q3): from the course plan, gated on configuration

Logan: *"From the course plan tab (need a selected course)."* A `⏺ Record this
course` control sits on the course-plan results screen; stop is on the strip
(hold, so it cannot be brushed) and on the notification.

Two consequences:

- **This amends founding decision 8.** FD8 made the course link *optional* "so a
  casual sail can still be recorded". Starting from a planned course makes the
  link mandatory at the only entry point that exists. Either casual recording is
  dropped, or a second entry point is needed. **Flagged, not decided** — noted
  under Not yet specified on the map.
- **Connection config belongs to the boat profile.** Logan: *"connection details
  (IP, port, device-name, NMEA version) should be stored against boat profile,
  so you can't start capture unless it's configured."* This answers `11`
  question 2 outright and adds a **gating rule**: with no endpoint on the active
  profile, the start control is replaced by a "set up plotter" prompt. Handed to
  `11` (the UX and the discovery-vs-typed question) and `08` (the columns).

### 4. Connection state and confidence (Q4, Q5)

The strip answers both at once. Dot for state; the numbers themselves for
liveness. On drop, the numbers grey out and a **retrying** bar appears above the
strip with the gap noted; on death, a red **no data** bar. A dead feed is never
silent, which was this feature's worst failure mode. `11` owns the escalation
policy (vibrate, backoff, when to give up).

### 5. The notification (Q6): status only, no sail actions

Established from primary sources while resolving this ticket:

- Android's standard template shows **at most three action buttons**
  ([build-notification](https://developer.android.com/develop/ui/views/notifications/build-notification)).
  Against a wardrobe of 8–11 sails, a shortcut list can never be complete.
- A notification action whose `PendingIntent` targets a `BroadcastReceiver` that
  only writes to the DB **is** legal — Android 12's trampoline restriction only
  blocks a receiver or service calling `startActivity()`
  ([behavior-changes-12](https://developer.android.com/about/versions/12/behavior-changes-12)).
  So sail actions were mechanically possible; they were rejected on design.
- **Could not be established from primary sources:** whether such an action
  fires from the lock screen without unlocking (`setAuthenticationRequired`
  defaults and keyguard behaviour — the reference pages served navigation
  shells). Moot given the decision below, but if sail actions are ever revisited
  this must be verified on hardware in `13`.

**Decision: the notification is status-only.** Live TWS/TWA, sample count, time
since last stamp, and a single **Stop** action. A 3-of-11 shortcut list is a trap
— it gets tapped wrongly under load, and a wrong stamp is worse than no stamp
given §2's rule. Stamping is two taps in-app.

This also retires v1's variant C ("the notification is the UI") and, with it,
Q6's speculation that the notification might be a better answer than the screen.

### 6. Out of scope, confirmed by prodding it

v2 variant C made the Plan tab's wind card fill itself live from the plotter,
which fits Logan's constraint better than anything else in the round — and is
explicitly **out of scope** on the map ("Live telemetry on the Plan tab"). It was
built to test whether the boundary still holds now that the app is holding a live
feed while the user types the wind by hand. Logan chose A regardless, so **the
scope line stands**, now deliberately rather than by default.

### Not answered here

- The **attribution rule** for sparse stamps → `19`.
- **Review-time correction** of stamps → `10` q3, already open.
- **Reconnect policy, discovery, endpoint UX** → `11`.
- **Where past sessions are listed** → `10` q7.
- Whether **casual (course-less) recording** survives → fog.
