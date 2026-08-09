# Prototype the opt-in uncertainty planning experience

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

What is the smallest clear interaction and visual hierarchy for enabling TWD
uncertainty, setting its symmetric spread, reading central and possible TWA on
both planning flows, and understanding range-dependent alternate sails on an
affected course leg without cluttering unaffected planning?

## Answer

Four variants were prototyped as a standalone HTML page
([`../prototypes/03-planning-experience.html`](../prototypes/03-planning-experience.html),
`?variant=A|B|C|D`): a quiet annotation (A), a range band (B), scenario columns
(C), and a hybrid (D). **Variant D wins.** Each of A, B and C was strongest on
a different surface, so the accepted design assigns each treatment to the
surface where it earns its space.

### Wind input card

- A single **on/off control** enables uncertainty. When off, the spread control
  is **hidden** and the leg surfaces below are byte-for-byte today's UI.
- When on, a **symmetric `± spread` stepper** in `5°` steps sets the
  half-spread, alongside a **compass band** — a `0°–360°` track with the
  possible arc shaded and a tick at the central TWD — and a numeric line
  (`Possible wind 200° – 240°`).
- The band **splits into two fills** when the arc crosses `0°/360°`. Compass
  wrap carries no user-facing meaning (issue 02), so it must not render as a
  break or a fold.
- The band shows shape; the numeric line carries precision. Both are present.

### Single-leg plan (`DirectionsCard`)

A's treatment only: the existing central TWA stays dominant, with the possible
interval as a muted second line (`45° – 75° possible`) and the existing central
tack badge unchanged. **No band and no scenario columns** — this surface has no
sail suggestions, so it carries the interval and nothing else.

### Course leg list (`CourseLegCard`)

A's card, unchanged from today whenever uncertainty is off or no alternate
qualifies. When it does:

- The possible interval is a muted line under the big central TWA.
- **Alternates appear inline** on the existing sail badge row rather than
  behind a tap: `⛵ [Genoa] ← [Code 0] → [A2 Kite]`, where `←`/`→` denote the
  lower- and higher-TWD sides of the possible range (wind shift direction, not
  tack).
- **No band on this surface.** The list is scanned fast and one-handed; a
  graphic per leg costs more than it returns, and card height must not grow for
  unaffected legs.

### Leg details (`app/(plan)/course/leg.tsx`)

- The existing TWA/bearing card gains a **TWA band**: a `0°–180°` track with
  the possible interval shaded, a tick at the central TWA, and a coloured
  segment per alternate showing where it wins, plus the numeric interval.
- Below it, **one case card per scenario** — Left shift / Expected / Right
  shift — each carrying its TWD sub-range, its TWA sub-range, its sail badge,
  and the plain-language reason (`Code 0 below its 85° minimum TWA`,
  `18% faster than Genoa`). The Expected card is visually dominant; a side with
  no qualifying alternate reads `No change from the expected sail`.
- The band and the case cards say the same thing twice on purpose: the band for
  shape, the cards for numbers and reasons. This is the one surface with room
  to study both.

### Accepted consequences

- The same band visual appears on two axes — the `0°–360°` compass in the wind
  card and the folded `0°–180°` TWA on leg details. This rhyme is intended;
  the axis labels distinguish them.
- Uncertainty is additive everywhere: with it off, or with a spread too narrow
  to qualify an alternate under issue 01's persistence rule, every surface is
  identical to today.

### Left open

How the case cards coexist with the existing `SuggestionBreakdown` on the
leg-details screen is **not** settled here — the prototype stops above it. That
screen would otherwise present the range story and then a full ranked list
evaluated at the central TWA only. Carried to a new ticket:
[Define how alternates and the existing suggestion breakdown coexist](06-define-leg-details-breakdown-integration.md).
