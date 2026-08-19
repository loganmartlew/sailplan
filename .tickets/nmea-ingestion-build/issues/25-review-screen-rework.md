# 25 — The review screen, reworked

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8. User stories 44–61, 67.
Revises tickets [`14`](14-sailed-legs-and-review-pager.md) and
[`16`](16-review-map.md).

**What to build:** Build `24`'s accepted variant, and split confirmation into the
two things it has always been doing at once — *the sailor has looked at this leg*
and *this data is cleared to enter the polar*. Review becomes something you can
pause, wander and come back to without losing work; committing stays one
deliberate session-level decision, made later, in `18`.

**Blocked by:** `24` — **done**. `24` accepted **variant D**, "the list is home,
one route names the leg": see its
[Accepted section](24-review-screen-prototype.md#accepted--variant-d-19-august-2026)
for the reasoning, and
[`24-review-screen-shape.html`](../../nmea-ingestion/prototypes/24-review-screen-shape.html)
(`?variant=D`) for the drawing. D was not one of the three this ticket's parent
asked for; it came out of the round rather than into it.

Three things `24` settled that change what is written below:

1. **D is the split this ticket already described.** No terminal action, review
   ends by going back, leg list on the session screen, `Promote` as the
   session's one CTA — all drawn.
2. **`reviewedAt` should mean *edited*, not *visited*.** `24` derives it from
   the spans having changed. Setting it on a mere visit marks legs with no hand
   work to lose, which is the wrong answer for both the re-detect warning and
   the resume guard.
3. **The steadiness overlay is justified and is drawn** — the mask fires on
   every leg of the real race. But `24`'s follow-up probe found the mask far
   tighter than spec §8 assumed: the whole race attributed to one sail yields
   **10 polar points against §8's expected ~45**, almost entirely because of
   `MAX_TWS_DEVIATION = 1`. That is `18`'s to act on, not this ticket's — but
   this ticket draws the overlay, so it will be visibly sparse and that is
   correct, not a drawing bug.

**Status:** ready-for-agent

## Why this reverses `14`

Ticket `14` decided that **advancing the pager is what confirms the leg** —
*"review is a single pass, not a pass plus a confirmation chore"*. That is a good
instinct about not making sailors click twice, welded to a bad consequence: the
only way to record work is to move forward past it, so there is no way to step
back through a session without either losing edits or re-confirming legs, and no
way to pause a review at all.

Real use surfaced it. With 7 legs of wildly uneven size, the sailor wants to
roam — check leg 3 against leg 5, come back tomorrow — and the shipped model has
no vocabulary for that.

The fix is not to add a confirm button. It is to notice that `confirmedAt` has
**two consumers with two different meanings**:

| Consumer | What it actually means |
| --- | --- |
| `SailedLegReviewPager.tsx:143` — open on the first unconfirmed leg | the sailor has started work here |
| `SailedLegReviewPager.tsx:70` — re-detect warning | the sailor has started work here |
| `captureResume.ts:24` → `captureSession.ts:208` — block resuming an auto-ended recording | the sailor has started work here |
| `18` (unbuilt) — only confirmed spans produce points | this data is cleared for the polar |

Three of the four are one idea. The fourth is a different idea entirely, and it
belongs to promotion.

**The third row is the trap.** If per-leg state simply disappeared in favour of
"nothing is confirmed until promotion", an auto-ended session could still be
resumed after the sailor had hand-edited five legs — and `redetectCaptureReview`
would delete every span they drew, with no warning, because by its own reckoning
nothing had been confirmed. `reviewedAt` exists to keep that door shut.

This also brings the build **closer** to `18`'s stated intent. `18` says
*"promotion is a decision, not a side effect of finishing review"* — yet today
per-leg confirmation is precisely a side effect of pressing Next.

## Domain

`CONTEXT.md` updated ahead of this ticket: **Reviewed** and **Promotion** added,
**Sail-attribution span** rewritten so a draft is the app's hypothesis rather
than the sailor's claim.

## Acceptance criteria

### Navigation and persistence

- [ ] Free previous/next leg navigation at the top of the review screen, in the
      shape `24` accepted — D puts ‹ › in the route header and pages by
      `replace`, so the back stack stays at one and a leg keeps its own path.
      `24` left open whether the ‹ › earn their place at all once returning to
      the list is cheap
- [ ] Moving between legs **persists** spans, name and `used` — no confirm action
- [ ] `sailedLeg.confirmedAt` becomes `reviewedAt`, set by navigating away from a
      leg. Migration preserves existing confirmations as reviews
- [ ] `confirmSailedLegPresentation` splits: a draft save that writes spans, name
      and `used`, and leaves promotion alone
- [ ] Resume position, the re-detect warning, and the resume block all read
      `reviewedAt`. The re-detect warning says *reviewed*, not *confirmed*
- [ ] **`captureResume` is covered by a test**: an auto-ended session with at
      least one reviewed leg is not resumable. This is the one genuinely
      destructive edge in the ticket — getting it wrong means a resumed recording
      silently destroying hand-drawn spans
- [ ] **No terminal action.** Review ends by going back; there is no "Finish" and
      no "Review complete" card. The session screen carries progress, and its
      `Promote` CTA routes into `18`/`19`'s final review screen, which owns
      promote-or-exit
- [ ] Unreviewed legs carry only draft spans and so contribute nothing to
      promotion — `18` reads `reviewedAt` as its gate

### Structure

- [ ] `24`'s accepted variant **D**, including the session/leg split it settled:
      the session screen is the list, and one route named for the leg sits under
      it
- [ ] A **leg list** on the session screen: name, duration, review state, and a
      jump into any leg. Today the only way to learn what is in a session is to
      page through it
- [ ] The nested card inside the leg card is gone
- [ ] **The ground-wind and low-confidence warnings move above the leg work.**
      `[sessionId].tsx:87–110` currently renders them below the entire pager — a
      warning that the data may be systematically wrong, two and a half screens
      beneath the UI used to accept it

### The chart

- [ ] `24`'s accepted treatment: truthful axis, gridlines, the max labelled as a
      max rather than the `× 1.15` ceiling, and no-sail shading that does not read
      as background chrome
- [x] The steadiness overlay — `24`'s measurement justified it (fires on every
      leg; 22.0 % of leg time, 72 stretches, zero legs with none). Draw the
      shipped mask, not a loosened one; `18` owns the threshold

### Consistency with the rest of the app

- [ ] Full-width segmented control under the heading for leg ⟷ course focus,
      matching Plan's `Leg/Course` and Polar Chart's `Polar/Scatter` — not the
      small right-aligned toggle inside a card
- [ ] Uppercase muted field labels on the session stats, matching Plan's
      `TRUE WIND SPEED`. Today `3.4–25.4 kn` is unlabelled and unguessable as wind
- [ ] The duplicated `No sail` goes — `SailSpanEditor.tsx:315–338` shows it both
      as the dropdown's current value and as the button beside it, so the second
      reads as a different control
- [ ] A real screen title. `Session` in the header with a machine-generated
      `Recording 15/08/2026, 12:36:50 pm` as the `H2` spends the largest type on
      screen on the least useful string, while the leg being reviewed is muted
      14 px text below the fold

### Spec and ticket amendments

- [ ] `14`'s criteria amended to record the reversal of *advance = confirm*, in
      the explicit style `16`→`23` and `10`→`22` used — what real use showed, not
      a silent edit
- [ ] Spec §8 amended to match
- [ ] `16`'s map criteria carried forward unchanged; this ticket does not touch
      the map's read-only rule

## Deliberately not in this ticket

- **The point count** still reads `387 samples` beside the `used` toggle. `26`
  replaces it, and spec §8's *"the toggle beside its point count"* stays unmet
  until then. Known-wrong number, one ticket longer
- **Moving review out of Settings.** The whole post-race workflow lives four
  levels deep behind a gear icon, in the same menu as Units and Appearance, even
  though recording starts in the Plan flow (`app/(plan)/course/plan.tsx:132`) and
  is tracked by a global bar (`_layout.tsx:139`). The loop never closes where it
  started. See `27`
