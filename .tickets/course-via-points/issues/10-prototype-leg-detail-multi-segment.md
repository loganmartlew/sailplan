# Prototype the Leg detail screen under multi-Segment Legs

Type: prototype
Status: resolved
Blocked by:

## Question

What does the Leg detail screen (`app/(plan)/course/leg.tsx`) become once a Leg
contains Via Points — is it the detail of a single **Leg Segment** or of a
whole Mark-to-Mark **Leg** showing every Segment inside it, and what does that
screen look like at zero, one, and several Via Points?

Today the screen renders exactly one bearing, one TWA, and one
`SuggestionBreakdown` for a `from → to` pair, reached from a `CourseLegCard`
with a serialized `legData` blob. That works only because a Leg has exactly one
Segment. Bearing, TWA, tack, and sail guidance belong to the **Leg Segment**,
so the screen's real unit is already a Segment — but nothing has confirmed that
a per-Segment screen is the right sailor experience, and ticket
[04](04-prototype-plan-presentation.md) explicitly pushed the route-journal
prev/next interaction *toward* Leg detail as a possible home without deciding
anything.

### Why this is a prototype and not a data-flow question

[09](09-specify-route-query-and-plan-calculation.md) owns the serialization
half — "does the leg detail screen receive a Leg with its Segments, a single
Segment, or something else, and does either Zod schema change shape?" That
question cannot be answered from data-flow reasoning alone: the two options
produce visibly different screens, and the choice should be made by looking at
them. **This ticket settles the presentational half; 09 consumes the result.**
09 was already claimed and in progress when this ticket was raised, so its body
was deliberately left untouched.

### What the prototype must confront

- **The screen is already crowded.** The wind-shifts effort has fully specified
  this screen under wind uncertainty — TWA band in the TWA/bearing card, then
  Left shift / Expected / Right shift case cards, then an untouched
  `SuggestionBreakdown` under an `All sails` heading. See
  [Define how alternates and the existing suggestion breakdown coexist](../../../../sailplan.wind-shifts/.tickets/wind-direction-uncertainty/issues/06-define-leg-details-breakdown-integration.md)
  and the mockup at
  `sailplan.wind-shifts/.tickets/wind-direction-uncertainty/prototypes/03-planning-experience.html`.
  That prototype mentions "Leg details" eight times and "Segment" zero times —
  it was built before Via Points split a Leg, so it assumes one Leg is one
  Segment throughout. A per-Leg screen would multiply all of that by the
  Segment count; a per-Segment screen would not, but then the Mark-to-Mark Leg
  has no detail screen at all.
- **Route point notes land here.** Ticket
  [08](08-decide-route-point-notes.md) decided this screen shows, in full and
  unclamped, the notes of every route point it covers, in route order, beside
  the endpoint labels that already carry the P/S `direction` badge. That rule
  was stated unit-agnostically precisely so it holds whichever way this ticket
  goes — a per-Segment screen shows its two endpoints' notes, a per-Leg screen
  shows every point in the Leg.
- **Rounding direction.** Course Marks carry `direction`; Via Points never do
  (per [01](01-establish-via-point-domain.md)). A Segment boundary that is a
  Via Point has no P/S badge, so the endpoint labels are not uniform.
- **Navigation.** Where the sailor taps to arrive here changes with the answer:
  Plan results show Mark-to-Mark Leg groups containing lighter Segment rows
  (ticket 04), so a per-Segment screen is reached from a Segment row and a
  per-Leg screen from the group header.

Compare variants at zero, one, and several Via Points, with wind uncertainty
both off and on, since the off case must stay byte-for-byte today's screen.

## Answer

**Leg detail is the detail of one Leg Segment**, not the whole Mark-to-Mark
Leg. Settled against a five-variant prototype, in two passes — the first
three read as crowded and not felt-friendly; a per-Segment screen with a
small addition, below, is what survived.

- **The Leg-bounds banner is part of the decision, not optional polish.** A
  slim header — `LEG 2  Windward P → Leeward Gate S` — names the Leg's two
  actual bounding Course Marks above the focused Segment's own endpoint pair,
  carrying the same P/S badges the rounding-direction rule already reserves
  for them. Without it, a sailor drilled into `Windward → Headland clearance`
  has no way to see they're still inside `Leg 2: Windward → Leeward Gate`; a
  Segment-only screen isn't the right shape without it.
- **Navigation**: reached from a Segment row in Plan results (ticket
  [04](04-prototype-plan-presentation.md)), not from the Leg group header —
  there is no per-Leg screen to reach. The group header stays a
  non-interactive heading.
- **Route point notes** (ticket [08](08-decide-route-point-notes.md)): the
  Segment-screen branch of that unit-agnostic rule applies — two endpoints'
  notes only, unchanged from what's shown today.
- **Data contract** (ticket [09](09-specify-route-query-and-plan-calculation.md)):
  unaffected. `legRef` + `segmentIndex` was deliberately kept generic enough
  for either answer; this ticket confirms `segmentIndex` names the focused
  Segment and `legRef` supplies the Leg-bounds banner plus the enclosing Leg's
  other Segments for moving between them.
- **Not decided here**: the control for moving to another Segment in the
  same Leg. A prev/next stepper and a tappable position-dot strip both read
  fine once the Leg-bounds banner is in place — the stepper is the current
  pick, cheap to swap for the dot strip later; that choice belongs at
  implementation time, not this ticket.

### Rejected

- **Whole-Leg, every Segment expanded** — confirmed the crowding risk this
  ticket called out: four complete TWA/case-cards/breakdown blocks stacked on
  one screen at Leg 3 with wind on.
- **Whole-Leg, one Segment focused** — better than the above, but still
  carries a route thread and a stacked list of collapsed Segment rows a
  Segment-only screen doesn't need.
- **Whole-Leg, tab strip** — the strongest of the whole-Leg attempts, and not
  disliked. Rejected anyway: a whole-Leg screen answers "what does this Leg
  look like end to end", which Plan results (ticket 04) already answers one
  level up with its Mark-to-Mark Leg groups. A Segment-only Leg detail avoids
  building a second screen for the same overview.

## Comments

- **Prototype asset**: [leg detail multi-Segment mockup](../prototypes/leg-detail-multi-segment/index.html?variant=segment)
  — run `python3 -m http.server 8000 --directory .tickets/course-via-points/prototypes/leg-detail-multi-segment`;
  see its [README](../prototypes/leg-detail-multi-segment/README.md). Five
  variants (two passes) across Legs with zero, one, and three Via Points, wind
  uncertainty off through ±30°.
- **Human verdict**: `segment` accepted, with the Leg-bounds banner added in
  the second pass. `segment-lean` (dot-strip swap control) is an accepted
  alternate for the same unit, not chosen only because the call between the
  two was a coin flip.
