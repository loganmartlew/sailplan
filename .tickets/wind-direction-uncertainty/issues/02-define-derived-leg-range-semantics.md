# Define TWA and tack semantics across uncertain TWD

Type: grilling
Status: resolved

## Question

How should a circular, symmetric TWD range be transformed into user-facing
per-leg guidance when the derived TWA folds at 0 degrees or 180 degrees,
crosses one or both tacks, or spans wind-zone boundaries—and which of those
facts belong in the implementation-ready specification and UI?

## Answer

Derive two pieces of leg guidance from the central TWD and the validated TWD
uncertainty half-spread:

1. The existing **central TWA**, including only its existing central tack.
2. An inclusive **possible TWA interval** containing the TWA produced by every
   TWD in the circular uncertainty range.

For a central TWA `c` and half-spread `s`, where `0 <= s <= 40`, the possible
TWA interval is:

```text
[max(0, c - s), min(180, c + s)]
```

This is the folded image of the full TWD range, not merely the range between
the two endpoint TWAs. A range crossing head-to-wind includes `0°`; a range
crossing dead downwind includes `180°`. Compass wrap at `0°/360°` has no
special user-facing meaning and does not by itself create a fold.

Examples for a `0°` leg bearing:

- Central TWD `350° ±20°` gives central TWA `10°` and possible TWA `0°–30°`.
- Central TWD `170° ±20°` gives central TWA `170°` and possible TWA
  `150°–180°`.

Tack remains exclusively a property of the central TWA. Do not derive, return,
or display a possible-tack set, tack-change flag, or singular no-tack state for
the uncertainty range. If the central TWA is exactly `0°` or `180°`, its tack
is `null` and the badge is omitted, even if uncertainty extends onto both
tacks.

Do not return or display the set of wind zones crossed by the possible TWA
interval. Existing numeric zone boundaries continue to classify each TWA at
the point where sail evaluation needs them: upwind below `80°`, reaching from
`80°` through `150°`, and downwind above `150°`.

Calculations retain full precision. User-facing central and interval angles
are rounded to whole degrees. The visible central tack must agree with the
visible rounded angle: omit its badge when the central angle displays as `0°`
or `180°`.

TWD uncertainty is a symmetric half-spread with a closed valid domain of
`0°–40°`; `40°` means central TWD `±40°`, an `80°`-wide arc. Schema boundaries
reject values outside that domain, and downstream geometry may assume a
validated value.
