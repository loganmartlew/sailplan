# Leg detail under multi-Segment Legs — throwaway prototype

Standalone HTML prototype for
[Prototype the Leg detail screen under multi-Segment Legs](../../issues/10-prototype-leg-detail-multi-segment.md).

Today's `app/(plan)/course/leg.tsx` renders exactly one bearing, one TWA, and
one `SuggestionBreakdown` for a `from → to` pair — that works only because a
Leg has exactly one Segment before Via Points. This prototype asks the
question ticket 09 deliberately left open: once a Leg can contain several
Segments, is Leg detail **the detail of one Leg Segment**, or **the detail of
the whole Mark-to-Mark Leg**?

Two things are already decided elsewhere and are rendered identically across
all five variants, not varied by this prototype:

- **Route point notes** ([ticket 08](../../issues/08-decide-route-point-notes.md)) —
  full, unclamped, in route order, beside the endpoint labels that carry the
  P/S `direction` badge.
- **Wind-uncertainty case cards** (wind-shifts
  [ticket 06](../../../../sailplan.wind-shifts/.tickets/wind-direction-uncertainty/issues/06-define-leg-details-breakdown-integration.md)) —
  stacked `Left shift` / `Expected` / `Right shift` cards above an untouched
  `SuggestionBreakdown`, with a muted "no alternate qualified" line replacing a
  card on the side that doesn't qualify. At `spread = 0` the screen is
  byte-for-byte today's: no case cards, no second `All sails` heading.

Run from the repository root:

```sh
python3 -m http.server 8000 --directory .tickets/course-via-points/prototypes/leg-detail-multi-segment
```

Open <http://localhost:8000/?variant=segment>. The floating bar at the
bottom, or the left/right arrow keys, cycles variants. The header carries a
Leg picker (0 / 1 / 3 Via Points) and a wind-spread picker (Off / ±10° / ±20°
/ ±30°) that both persist across variant switches, so the same scenario can be
compared structurally.

**Second pass.** The first three variants (A/B/C) read as crowded and not
felt-friendly on review — none was picked. `segment-lean` and `leg-tabs` are a
second attempt at the same two units, keeping A/B/C in place so all five can
be compared directly rather than judging the new ones in isolation.

**Third pass.** A and A2 read as the same screen with a different Segment
swap control — fine either way — but both were missing the actual Leg: only
the focused Segment's immediate endpoints showed, never the two Course Marks
the whole Leg runs between. Both now open with a **Leg-bounds banner**
(`LEG 2  Windward P → Leeward Gate S`) naming the real bounding marks, with
the same P/S badges the rounding-direction rule already reserves for
Leg-bounding Course Marks — so `Windward → Headland clearance` (the Segment)
reads inside `Windward → Leeward Gate` (the Leg), not as if it were the whole
Leg. B/C/D didn't need this: their route thread already opens on the same two
Course Marks.

**Current pick: A over A2**, for now. Both read the same with the Leg-bounds
banner in place — the only real difference left is stepper-card vs.
position-dot swap control — and the call was a coin flip, so the stepper
stays as the default (`?variant=segment` with no param) since it's cheap to
swap back to A2 later if it turns out to matter. This doesn't settle
ticket 10's actual question (Segment vs. whole Leg) — D is still a live
alternative there.

## Variants

- `?variant=segment` — **A, Segment detail.** Today's screen: two endpoint
  labels, one TWA/bearing card, one Sail Suggestions section. Reached from a
  Segment row (ticket 04's Plan-results groups). A breadcrumb
  (`Leg 2 · Segment 1 of 2`) and a prev/next stepper move along the enclosing
  Leg's other Segments without leaving the screen — the interaction ticket 04
  pushed toward Leg detail without deciding.
- `?variant=leg-full` — **B, whole Leg, every Segment expanded.** Reached from
  the Leg group header. A route thread of every point in the Leg (with notes)
  sits above a full TWA/bearing/case-cards/breakdown block **per Segment**,
  stacked in route order. This is the stress test: at Leg 3 (three Via
  Points, four Segments) with wind on, it is four complete guidance sections
  on one screen.
- `?variant=leg-focus` — **C, whole Leg, one Segment focused.** Same route
  thread, but only the Segment named by `segmentIndex` expands to the full
  treatment; its Leg-mates collapse to a one-line summary
  (`Mole End → Channel North · 98° · Code 0`) that re-focuses on tap. Answers
  "detail of a Segment or of a Leg?" with "the Leg is the container, the
  Segment is the focus" — directly exercising ticket 09's `legRef` +
  `segmentIndex` param contract.
- `?variant=segment-lean` — **A2, Segment detail, lean.** Same unit as A —
  two endpoint labels, one TWA/bearing card, one Sail Suggestions section —
  but the breadcrumb-and-stepper card is replaced by a row of tappable
  position dots (`① ② ③ ④`, current one filled). Every Segment in the Leg is
  visible and reachable at a glance, not just "prev" and "next", without the
  box-in-a-box weight of the stepper card.
- `?variant=leg-tabs` — **D, whole Leg, tab strip.** Same route thread as
  B/C (still required by ticket 08's "every route point in the Leg"
  rule), but the stacked collapsed rows become a horizontal, scrollable
  segmented-control strip — one tab per Segment, each showing TWA and the
  primary sail. Tapping a tab swaps which Segment expands below, at no
  vertical cost for the Leg-mates that aren't focused. This is the direct
  answer to "make the full-Leg one better": same information as C, arranged
  so switching focus doesn't scroll past a list.

## What is rendered

- The same fictional course as the sibling prototypes (`Winter Series —
  Harbour Loop`), so route points, notes, and Mark-backed/local status line up
  across prototypes: **Leg 1** (Start → Windward, 0 Via Points), **Leg 2**
  (Windward → Leeward Gate, 1 local Via Point, one Segment falls back to
  "Best available"), **Leg 3** (Leeward Gate → Finish, 2 Mark-backed + 1 local
  Via Point across 4 Segments).
- Rounding direction exactly where ticket 09 specifies it: `P`/`S` only on the
  two Course-Mark ends of a Leg, never inherited onto an interior Via Point
  boundary.
- All three "how many sides qualify" cases from wind-shifts ticket 06: both
  sides qualify (Leg 3, Segment 1), one side only (Leg 2 Segment 1, Leg 3
  Segment 3), and neither side qualifies (Leg 1, Leg 2 Segment 2, Leg 3
  Segments 2 and 4) — each rendering the correct mix of case cards and muted
  "no alternate qualified" lines.

Everything is in memory; picking a Leg or wind spread persists when you switch
variants, so you can hold the scenario constant and compare structure. This is
prototype evidence only: it decides and implements no production behaviour.
