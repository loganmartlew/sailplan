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

**Status:** ready-for-human

- [x] A slim strip between content and tab bar, rendered on **every** screen
      while recording, carrying: connection dot, live **TWS** and **TWA** in
      large mono digits, the last stamp with its age, and a `✚` target
- [x] The whole strip is one touch target
- [x] **Nothing renders when not recording** — no collapsed strip, no placeholder
- [x] The last stamp is shown explicitly as **history**, its age turning amber
      past fifteen minutes — never readable as a claim about now
- [x] Tap the strip → bottom sheet → tap a sail → one `sailStamp` row. Two taps
- [x] The sheet is a two-column grid of large colour-coded targets and
      **scrolls**; a wardrobe of more than eight sails works one-handed
- [x] An undo toast (~9 s) fixes an obvious mis-tap in the moment
- [x] Nothing in the UI can express an interval or turn a sail off
- [x] Holding the strip stops the recording; a brush of a wet hand cannot
- [x] A `useCaptureInset()` hook gives every scrollable screen a bottom inset
      equal to the strip height while recording. Applied to all **9**: `(plan)/index`,
      `(plan)/course/plan`, `(plan)/course/leg`, `marks/index`, `courses/index`,
      `courses/courseGroups/[courseGroupId]`, `sails/index`,
      `sails/[sailId]/polar-chart`, `sails/[sailId]/twa-limits`
- [x] The notification gains live TWS/TWA, sample count and time since the last
      stamp, keeping **Stop** as its only action (sail actions are mechanically
      legal and rejected on design — three slots against 8–11 sails, and a wrong
      stamp is worse than no stamp)
- [ ] Verified on a device: the last card is reachable on every scrollable screen
      while recording, and stamping works one-handed

## Comments

Implementation completed 2026-08-12. The established pill-shaped capture strip
and solid record control were preserved. Automated verification covers live
parser state, stamp-age boundaries, notification copy and session-bound Stop
links; all 283 tests, strict TypeScript, lint (pre-existing warnings only), Expo
prebuild and an Android debug assembly pass. The final device/one-handed check
remains for a human, so the ticket is not marked `done` yet.

### U1 — hold-to-stop is not discoverable (2026-08-14, from Session B)

**Raised by the human during the T06-1/2/3 device block.** This is a design
problem, not a bug: hold-to-stop *works* exactly as the acceptance criterion
above specifies, and T06-3 passed on it. The criterion itself is what needs
rethinking.

**The problem.** Nothing on screen tells a user that holding the strip stops the
recording. The strip advertises one affordance and it is the wrong one: a tap —
the gesture a user will try first — opens the sail stamp picker, so the
discoverable action is *stamping*, not *stopping*. A user who wants to stop and
does not already know about the hold has no in-app path to it. They can tap the
strip (picker), brush it (picker), or look at the strip's contents (connection
dot, TWS/TWA, last stamp) and find no stop control at all.

The **Stop** action in the notification is currently the only labelled way to
stop, and it is not in the app. On this device it is worse than it sounds: the
capture notification is `mImportance=2` / `pri=-2`, so it sits in the shade's
collapsed **silent** section below the fold — during Session B it took several
attempts to reach it even while looking for it deliberately.

**Why the current design chose a hold.** The criterion pairs "holding the strip
stops the recording" with "a brush of a wet hand cannot" — the hold exists to
make an accidental stop impossible in a seaway. That constraint is real and was
verified: the human's deliberate careless brush did not stop the recording.
Any redesign has to keep that property.

**What is worth reconsidering.** The tension is that one gesture target is
carrying two actions of very different weight, and the destructive one is the
hidden one. Options, none of them decided:

- a visible stop affordance on the strip (an explicit control, distinct from the
  stamp target) that itself requires a deliberate confirm — keeps
  accident-resistance without hiding the action;
- a hold that *shows* it is happening — a progress ring or fill on the strip
  that appears on touch-down, so the gesture is self-teaching the first time a
  user rests a thumb on it;
- surfacing stop where the user already went looking for it — the course plan
  screen that started the recording;
- at minimum, a first-run hint on the strip.

**Not urgent for correctness, but it is a real on-the-water failure mode:** a
user who cannot stop a recording will force-quit the app, and ticket `07`
exists because of what resume/ANR does around that path.
