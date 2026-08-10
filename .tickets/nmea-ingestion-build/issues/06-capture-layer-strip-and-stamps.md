# 06 — The capture layer: strip and sail stamps

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §5. User stories 18–31.

**What to build:** While recording, a slim strip sits above the tab bar on every
screen — a connection dot, live TWS and TWA in large mono digits, and the last
stamp with its age. One glance says it is genuinely working, and a
frozen-but-connected feed cannot masquerade as a healthy one. Tap it, tap a sail:
that is a stamp. The course plan stays fully usable throughout, and when the app
is not recording nothing renders at all.

**There is no capture screen.** Capture is a layer over the app already in use,
and it belongs above the tab navigator, not inside any screen.

**The load-bearing rule everything downstream inherits: a stamp does not
propagate forward.** Forgetting to stamp must produce *unattributed* samples,
never *wrongly attributed* ones. Silent misattribution poisons a polar; an
unattributed stretch merely wastes it.

**Blocked by:** `04`, `05`.

**Status:** ready-for-agent

- [ ] A slim strip between content and tab bar, rendered on **every** screen
      while recording, carrying: connection dot, live **TWS** and **TWA** in
      large mono digits, the last stamp with its age, and a `✚` target
- [ ] The whole strip is one touch target
- [ ] **Nothing renders when not recording** — no collapsed strip, no placeholder
- [ ] The last stamp is shown explicitly as **history**, its age turning amber
      past fifteen minutes — never readable as a claim about now
- [ ] Tap the strip → bottom sheet → tap a sail → one `sailStamp` row. Two taps
- [ ] The sheet is a two-column grid of large colour-coded targets and
      **scrolls**; a wardrobe of more than eight sails works one-handed
- [ ] An undo toast (~9 s) fixes an obvious mis-tap in the moment
- [ ] Nothing in the UI can express an interval or turn a sail off
- [ ] Holding the strip stops the recording; a brush of a wet hand cannot
- [ ] A `useCaptureInset()` hook gives every scrollable screen a bottom inset
      equal to the strip height while recording. Applied to all **9**: `(plan)/index`,
      `(plan)/course/plan`, `(plan)/course/leg`, `marks/index`, `courses/index`,
      `courses/courseGroups/[courseGroupId]`, `sails/index`,
      `sails/[sailId]/polar-chart`, `sails/[sailId]/twa-limits`
- [ ] The notification gains live TWS/TWA, sample count and time since the last
      stamp, keeping **Stop** as its only action (sail actions are mechanically
      legal and rejected on design — three slots against 8–11 sails, and a wrong
      stamp is worse than no stamp)
- [ ] Verified on a device: the last card is reachable on every scrollable screen
      while recording, and stamping works one-handed
