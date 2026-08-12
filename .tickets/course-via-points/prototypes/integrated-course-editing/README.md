# Integrated Course editing flow — throwaway prototype

Standalone HTML prototype for the Wayfinder ticket
[07 — Prototype the integrated Course Detail map-editing and Plan return flow](../../issues/07-prototype-integrated-course-editing-flow.md).
It combines the accepted decisions already made by tickets 03 (Route thread +
map sheet), 04 (Mark-to-Mark Plan groups), 05 (no draft — writes are
immediate and durable), and 06 (Mark-backed styling, Change Mark, promotion).

Run from the repository root:

```sh
python3 -m http.server 8000 --directory .tickets/course-via-points/prototypes/integrated-course-editing
```

Open <http://localhost:8000/?variant=sheet-toast>. The floating control at the
bottom, or the left/right arrow keys, cycles the three variants (arrows are
ignored while a text field is focused). **`sheet-toast` (A) is the leading
direction after HITL review** — `full-log` and `inline-row` remain as
primary-source comparison evidence.

## What's being compared

There is no draft and no Save/Cancel anywhere in this prototype — every
rename, reorder, remove, promote, and Change Mark commits the instant it's
unambiguous. So the open question isn't "how does editing get confirmed",
it's **how the Course Map relates to Course Detail, and how each committed
action gets reversed.** The three variants pair a transition model with a
reversal model:

The one deliberate exception is dropping or moving a map pin: the position
previews on the map and waits for an explicit **confirm** before it commits,
because a spatial tap can't be judged correct until you can see it against
the route (HITL feedback on the first pass, which committed and closed the
sheet immediately on tap). Every other action still commits on the one
gesture that expresses it.

- `?variant=sheet-toast` — **A · Sheet + snackbar.** The Course Map opens as a
  bottom sheet over a dimmed Course Detail — the familiar "layer on top"
  pattern. Each action surfaces one dismissible snackbar with **Undo**; a new
  action, or dismissing it, retires the previous one for good.
- `?variant=full-log` — **B · Full screen + change log.** The Course Map takes
  the whole phone, with an explicit "‹ Back to Course Detail" instead of a
  dim backdrop. A persistent **Recent changes** drawer replaces the snackbar:
  every action stays listed and undoable in strict order (oldest-first
  entries grey out until the newer ones ahead of them are undone).
- `?variant=inline-row` — **C · Inline expansion + row-local undo.** The
  Course Map never leaves Course Detail — it expands in place in the scroll
  flow, an accordion rather than an overlay. Reversal lives on the exact row
  that changed (an inline "Undone? · Undo" chip, or a ghost row where a
  removed point used to sit) instead of in a shared toast or log.

## What's exercised

- **Saying where a new Via Point goes without a selection mode.** There is no
  selected Segment and no persistent highlight — a modal selection you set on
  one tap and spend on another is a desktop idiom, and nothing else in this
  design holds state between taps. Instead each surface scopes insertion the
  way that surface naturally can:
  - In the Route thread, the stretch between two consecutive points is itself
    a tappable **⊕ Insert** row. Tapping one opens the Add sheet already
    scoped to that gap, named by its two endpoints ("Mole End → Channel
    North") rather than by an index. The scope lasts exactly as long as the
    add does.
  - On the Course Map, **⌖ Drop a Via Point pin** takes no gap at all — the
    tap position picks it, by nearest Leg Segment. The inferred target is
    named and highlighted in amber before you confirm, so the guess is always
    visible and correctable by tapping elsewhere.
  Worth watching for: nearest-segment inference gets ambiguous where legs run
  close together or cross, which is exactly why the target is stated in words
  before the confirm rather than after. **This is provisional** — the ⊕ Insert
  row is adopted for want of a better idea, not because it convinced anyone.
  See ticket 07's "Leg Segment selection removed" amendment for what would
  justify revisiting it and which alternatives were already rejected.
- Inserting a **course-local** Via Point by map pin (from both the thread's
  gap rows and the Course Map's own pin-drop entry point — placement started
  from Course Detail returns to Course Detail; started from the map stays on
  the map, per ticket 03). Tapping the map previews the pin and its default
  replaceable name; nothing is added until **Add Via Point** is tapped, and
  **Cancel** discards it. The same preview-then-confirm applies to relocating
  an existing local pin.
- Adding by **existing Mark** (the flat chooser from ticket 06, excluding only
  the Leg's own two boundary Course Marks) — this stays a single immediate tap,
  since picking a name from a list carries none of the spatial ambiguity a map
  tap does.
- Local and Mark-backed Via Points **side by side** in Leg 3 (◇ green outline
  vs ◆ filled blue, per ticket 06), on the map, the Route thread, and Plan
  results.
- Renaming, reordering within a Leg, the explicit **⇆ move across a Course
  Mark**, **Change Mark**, **Add to saved marks** (name-editable, coordinates
  read-only confirm sheet), and removing a Via Point — each immediate on its
  one gesture, each reversible in whichever style the active variant uses. The
  per-row **⋯** menu is a popover anchored to the tapped button (not an
  inline-expanding panel), dismissed by picking an item, tapping outside, or
  Escape.
- A **Course Mark move blocked** by affected Via Points (try Windward or
  Leeward Gate), naming the affected Leg(s) and their points.
- **Done · View Plan** from Course Detail into the read-only Course Plan,
  Mark-to-Mark grouped guidance, a recalculation banner when the Course
  changed since the Plan was last viewed, and **Edit saved course** from the
  Plan Map returning to the same Course Detail — the same editor, not a
  separate one.

Everything is in memory and shared across variants — edit the route in one
variant and switch to see the same data in the others. This is prototype
evidence only: it decides and implements no production behaviour, and makes
no claim that a route is navigable or safe.
