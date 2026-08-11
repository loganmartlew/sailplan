# Prototype the Leg detail screen under multi-Segment Legs

Type: prototype
Status: open
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
