# Route point notes — throwaway prototype

Standalone HTML prototype for the Wayfinder ticket
[Decide Via Point and Course Mark notes](../../issues/08-decide-route-point-notes.md).
It extends the accepted `thread` variant of the
[Course detail prototype](../course-detail-structure/) and the accepted `legs`
variant of the [Plan results prototype](../plan-results/).

The design is already decided — a 200-character `note` on both
`courseViaPoint` and `courseMark`, muted and clamped to one line in the Route
thread, on the ending Leg Segment row in Plan results. This prototype exists to
answer one thing the decision cannot assert: **does the row still work on a
phone** once a Via Point row carries a name, a badge, a clamped note, reorder
arrows, and a `⋯` menu.

Run from the repository root:

```sh
python3 -m http.server 8000 --directory .tickets/course-via-points/prototypes/route-point-notes
```

Open <http://localhost:8000/?variant=thread-note>. The floating bar at the
bottom, or the left/right arrow keys, cycles variants; arrows are ignored while
a text field is focused.

## Variants

- `?variant=thread-note` — **the decided design.** Route thread rows: point
  name + badge, a muted note clamped to one line beneath it, explicit in-Leg
  reorder arrows, and a `⋯` overflow menu, all on one row.
- `?variant=thread-compact` — name and note share a single line; reorder
  arrows collapse to a half-height stack. Same information, roughly 40% less
  row height, much less note visible before the ellipsis.
- `?variant=thread-stacked` — the note drops onto its own full-width line
  below the controls, so it competes with nothing horizontally. Taller than
  `thread-note`, but the clamp bites far later.
- `?variant=plan-note` — Plan results (`legs`) with each note on the Leg
  Segment row that **ends at** its point, under the `from → to` line. The chip
  pair toggles the custom Plan start, which is what switches the course's first
  point between a real Segment row and the **Leg 1 group header** fallback.

## What is rendered

- Legs with **zero** (Leg 1), **one** (Leg 2), and **three** (Leg 3) Via Points.
- **Local** (`◇ LOCAL`, green) and **Mark-backed** (`◆ SAVED MARK`, blue with an
  outlined glyph) Via Points side by side in Leg 3, per ticket 06.
- Points with and without notes — a row with no note renders no second line,
  no empty slot, no placeholder.
- A **197-character** note on the local Via Point "Headland clearance", three
  characters under the cap, so the clamp is genuinely exercised.
- The worst case: **Windward**, a Course Mark with both a `P` direction badge
  and a note.

## Interactions

Tapping a row opens that point's editor sheet (Via Point: name + note +
coordinates, with name and coordinates read-only when Mark-backed; Course Mark:
mark + direction + note). `⋯` opens the overflow menu — relocate / Add to saved
marks / remove for a local Via Point, Change Mark / remove for a Mark-backed
one, remove for a Course Mark. The note field enforces the 200-character cap
with a live counter, so you can type a note up to the limit and watch it clamp
in every variant. Reorder arrows move a Via Point within its Leg only.

Everything is in memory and shared across variants — edit a note in one variant
and switch to see it in the others. This is prototype evidence only: it decides
and implements no production behaviour, and makes no claim that a route is
navigable or safe.
