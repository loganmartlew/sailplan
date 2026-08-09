# Define the colour treatment for alternates on the band and in the list

Type: grilling
Status: open
Blocked by:

## Question

Issue 03 gives the leg-details TWA band "a coloured segment per alternate
showing where it wins", and issue 06 adds a muted `rangeNote` line to each
alternate's `SailEvaluationCard`. Neither says where those colours come from.

The obvious source is the user-chosen `sail.color`, which
`SailEvaluationCard.tsx:82-84` already renders as a dot and `CourseLegCard`
uses on its badges. But it is free-form user input: two sails may carry
near-identical colours, a colour may sit close to the card or band background
in either theme, and `sail.color` is optional — the existing fallback is
`#888888`, which on a muted band segment would be invisible.

Should the band segments and the `rangeNote` key off `sail.color` at all, or
should alternates instead be distinguished by a fixed lower/higher-TWD role
palette that is legible by construction? And whichever wins, what is the rule
when the colour is missing, collides with the other alternate, or fails
contrast against the surface?
