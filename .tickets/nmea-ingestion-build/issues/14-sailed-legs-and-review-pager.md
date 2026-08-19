# 14 — Sailed legs and the review pager

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §6, §8. User stories 44–49, 58–61.

**What to build:** Afterwards, sitting down, the sailor pages through the session
one **sailed leg** at a time — judged in units they would say out loud rather
than bins they have no intuition for. Legs are detected from the boat's own data,
so review works even for a session that was never planned as a course; with a
linked course, each leg is titled by the marks it ran between. A tack or a gybe
inside a beat stays inside one leg, so a race with 34 manoeuvres is 20 screens,
not 34.

Each leg opens **already trimmed** at both ends, so the hoist, the drop and the
leg-detection error are excluded by default rather than by the sailor remembering
to exclude them. Advancing the pager is what confirms the leg — review is a
single pass, not a pass plus a confirmation chore. **That last sentence was
reversed by [`25`](25-review-screen-rework.md); see the amendment below.**

**The end trim is not only for hoists and drops — it absorbs the leg-detection
error**, which is what makes a ±33 s boundary survivable. The trim defaults and
the detection tolerance are one decision; retune them together or not at all.

**Blocked by:** `05`, `13`.

**Status:** done — detection since superseded for the course-linked case by
[`22`](22-course-anchored-leg-detection.md). The `|TWA|` criteria below found
4 legs in a real 7-leg race; they remain the no-course path. The **pager and
*advance = confirm* were reversed by [`25`](25-review-screen-rework.md)**; see
the amendment below.

- [x] Legs detected over a **±90 s window** on a change in **median `|TWA|` of
      ≥25°**; minimum leg **180 s**; data gaps are boundaries
- [x] **The sign is ignored** — a tack flips TWA's sign and keeps its magnitude;
      a rounding changes the magnitude. Sign is which tack, magnitude is point of
      sail, and a course leg is a point of sail
- [x] Two legs separated **only** by a data-gap boundary, whose median `|TWA|`
      fall in the same 10° band, are marked a continuation of one leg and share
      its name and ordinal presentation
- [x] With a linked course, legs are titled by the marks they ran between; with
      none, they fall back to "Beat 3 / Run 3" and are renameable
- [x] **Legs and spans are stored, not recomputed on open** — materialised the
      first time review opens, so confirmation has a durable home and retuning
      the detection constants cannot orphan stored spans
- [x] Every leg opens as *not used / sail / not used* with **25 s** head and
      **10 s** tail guards
- [x] ~~The pager shows one leg at a time; **Next** confirms the visible blocks
      and moves on, **Finish** confirms the last leg~~
      — **reversed by `25`**, see below
- [x] Leaving review half-finished keeps the work already done and leaves the
      untouched legs as drafts; revisiting and changing a leg **replaces** what
      was stored
      — *`25` restated: what is kept is every leg the sailor edited, not every
      leg they advanced past*
- [ ] A leg is **used by default**, with the toggle beside its point count where
      the consequence of skipping it is visible while deciding
      — *partial: the toggle is built and `used` is stored on `sailedLeg`, but
      it sits beside the raw **sample** count, not the point count. Bins do not
      exist until `18`, which owns the rest.*
- [x] Unattributed and not-used samples stay in the recording, available for a
      better attribution later
- [x] `replayCaptureSession` extended to return `sailedLegs`
- [x] Tested against the windward-leeward race script: **20 sailed legs, 14/14
      roundings, 0 spurious boundaries**

Recorded, deliberately **not built**: GPS net-travel-bearing detection as a
backstop for consecutive legs at the same angle on opposite gybes. Do not retry
heading-based segmentation — a tack and a rounding are both ~90°, so it merges
nothing.

## Amendment — *advance = confirm* reversed by `25`, 19 August 2026

This ticket decided that **advancing the pager is what confirms the leg**, on the
reasoning that *"review is a single pass, not a pass plus a confirmation chore"*.
That is a good instinct about not making sailors click twice, welded to a bad
consequence.

**What real use showed.** The screen ran against a 2:14:50 race with 7 legs of
wildly uneven size (439 to 1,721 samples). The sailor wanted to roam — check
leg 3 against leg 5, put the phone down, come back tomorrow — and the shipped
model had no vocabulary for it: the only way to record work was to move forward
past it, so there was no way to step back through a session without either
losing edits or re-confirming legs, and no way to pause a review at all.

**Why the fix is not a confirm button.** `confirmedAt` had two consumers with two
different meanings. Three of its four readers — the resume position, the
re-detect warning and the resume block — meant *the sailor has hand work here*.
The fourth, promotion, meant *this data is cleared for the polar*. `25` split
them: `reviewedAt` carries the first and is set by an **edit**, not by a visit;
promotion carries the second and is one deliberate session-level decision.

**What replaced the pager** (`24` variant D, built in `25`): the session screen
is a leg list, one route names the leg, and the header's ‹ › page by `replace`.
There is no Finish and no "Review complete" — review ends by going back.

**What stands unchanged**: the leg as the unit of review, the band-and-divider
mechanic, the trim defaults, and the detection criteria above.
