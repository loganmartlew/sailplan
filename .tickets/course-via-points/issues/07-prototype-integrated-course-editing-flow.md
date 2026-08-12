# Prototype the integrated Course Detail map-editing and Plan return flow

Type: prototype
Status: resolved
Blocked by: 02, 03, 04

## Question

What single, coherent interaction should connect the Course Detail structural
view, its Course Map spatial sheet, and read-only Course Plan results so that
Via Point work feels like one Course editor rather than three competing editors?

After the blocking prototype tickets have human verdicts, build a refined,
standalone HTML mobile prototype that combines those chosen decisions and
compares meaningfully different transition models. Exercise the complete flow:

- say where a new Via Point goes without holding a selection between taps, and
  carry that target into the Course Map when placement moves there;
- insert, name, move, reorder, or remove a course-local or Mark-backed Via Point
  as an immediate durable action — there is no draft and no Save/Cancel
  boundary ([05](05-choose-persistence-model.md)); show how each action is
  reversed instead;
- return between the map sheet and Course Detail without losing a pending
  action's target;
- explain a Course Mark move blocked by affected Via Points;
- save the Course, return to a read-only Course Plan, and show recalculated Leg
  Segment guidance grouped beneath sailor-recognised Mark-to-Mark Legs; and
- enter **Edit saved course** from the Plan Map and return to the same coherent
  editing flow.

The prototype must make the ownership boundary explicit: Course Detail owns the
saved Course; its Course Map sheet is that Course's spatial representation, not
a separate screen or independently saved editor.

## Answer

### The Course Map is a bottom sheet over Course Detail

- The Course Map opens as a **partial-height bottom sheet** over Course Detail,
  dismissed by its × , by tapping the dimmed backdrop, or by Escape. It is not
  a full-screen destination and not an inline accordion. Course Detail stays
  visibly underneath, which is what makes the map read as *this Course's
  spatial view* rather than a second editor — the ownership boundary the brief
  demanded is carried by the layering itself, not by a label.
- Course Detail keeps its **collapsed inline map preview** as the entry point.
- A Map-pin placement begun from Course Detail returns to Course Detail; one
  begun from the map sheet stays on the sheet ([03](03-prototype-course-detail-structure.md)).

### Reversal is one snackbar, one action deep

- Each immediate action surfaces **one dismissible snackbar with Undo**. A new
  action, or dismissing it, retires the previous one for good.
- **Accepted consequence:** undo depth is exactly one. Because every route
  write is immediate and durable with no draft ([05](05-choose-persistence-model.md)),
  an action two steps back cannot be reversed — it must be manually re-edited.
  This was chosen over the persistent change log (variant B) knowingly: the log
  bought unlimited ordered undo at the price of permanent on-screen chrome in a
  view that is already dense, and the depth it bought is rarely reached in a
  route edit of a handful of points.
- Reversal chrome is **shared and global**, not per-row. Row-local undo
  (variant C) was rejected — it scatters reversal across the list and leaves a
  removed point's undo affordance sitting where the point no longer is.

### Insertion targeting: no selection mode (provisional)

- There is **no selected Leg Segment** and no persistent highlight anywhere.
  See the "Leg Segment selection removed" amendment below for the full
  reasoning, the provisional status, and the rejected alternatives. In short:
  the Route thread offers a **⊕ Insert** row in each gap between consecutive
  points, and the map's **⌖ Drop a Via Point pin** infers its gap from the tap
  position by nearest Leg Segment, naming the inferred target before the
  confirm.
- Amber on the map now means only "this is where your pending pin lands". The
  map highlights nothing at rest.

### Placement is the one deliberate confirm step

- Dropping or moving a map pin **previews the position and waits for an
  explicit confirm**, because a spatial tap cannot be judged correct until it
  is seen. Every other action — rename, reorder, remove, promote, Change Mark,
  add-by-existing-Mark — commits on the single gesture that expresses it.
- Adding by **existing Mark** stays a single immediate tap: picking a name from
  a list carries none of the spatial ambiguity a map tap does.

### Plan return

- **Done · View Plan** leaves Course Detail for read-only Plan results, grouped
  beneath Mark-to-Mark Legs ([04](04-prototype-plan-presentation.md)), with a
  **recalculation banner** when the Course changed since the Plan was last
  viewed.
- The **Plan Map is read-only**, for orientation only. **Edit saved course**
  returns to the same Course Detail the sailor left — Plan has no editor of its
  own.

## Comments

- **Human verdict: `sheet-toast` accepted** after HITL iteration on insertion
  targeting. `full-log` and `inline-row` are rejected but kept in the prototype
  asset as evidence; all three share one in-memory model, so the rejected two
  still demonstrate the same route edits.
- HITL direction: do not retain a standalone Course Map destination. The map is
  opened from Course Detail for read-only orientation or explicit editing,
  including dropping a Via Point pin on the map during placement.

### Constraint — Mark-backed points, from ticket 06

[06](06-decide-saved-mark-transition-behavior.md) settled that local and
Mark-backed Via Points must be **visually distinct** wherever they appear — map
pins, Route thread rows, and Plan results — because a Mark-backed pin is
silently undraggable and the styling is the only thing that teaches the rule.
The prototype must show both kinds side by side, plus the **Change Mark** action
(there is no detach) and the **Add to saved marks** confirm sheet on a local
point.

### Amendment — draft removed by ticket 05

The brief above originally asked for "one shared edit draft and one Save/Cancel
boundary". [05](05-choose-persistence-model.md) settled that route writes are
immediate and durable, with no draft state anywhere, so the transition models
this prototype compares are about **insertion targeting and reversal**, not
about committing a draft. The brief has been corrected in place.

### Amendment — Leg Segment selection removed (provisional)

The brief originally asked the sailor to **select a Leg Segment** and then act
on that selection. HITL rejected it: a persistent selected row you set on one
tap and spend on another is a desktop idiom, and nothing else in this design
holds state between taps. The brief has been corrected in place, and the
prototype no longer has a selection mode at all — `state.selected` is gone.

In its place, each surface scopes an insertion the way that surface naturally
can, and the scope lasts only as long as the add does:

- **Route thread** — the stretch between two consecutive points is itself a
  tappable **⊕ Insert** row, named by its endpoints ("Mole End → Channel
  North") rather than by an index. Tapping one opens the Add sheet already
  scoped to that gap. This replaces the per-Leg footer button entirely.
- **Course Map** — **⌖ Drop a Via Point pin** takes no target; the tap position
  picks the gap by nearest Leg Segment. The map highlights nothing at rest, so
  amber now means only "this is where your pending pin lands".

**Status: provisional, adopted for want of a better idea.** HITL is not
convinced by the ⊕ Insert row but could not name a stronger alternative, so it
proceeds rather than blocking. Two things would justify revisiting it:

1. **A gap row reads as a route element rather than an action.** It sits in the
   thread among real points and may be mistaken for something that exists on
   the water. Watch whether the ⊕ affordance carries enough weight.
2. **Nearest-segment inference is ambiguous where legs run close or cross.**
   Mitigated by naming the inferred target in words before the confirm, not
   after — a mitigation, not a fix.

The considered-and-rejected alternatives, so they are not re-proposed blind:
**append-to-Leg then reorder** (one button per Leg, but a two-step job whenever
the point belongs mid-Leg), and **map-first only** (no list gesture at all,
which leaves adding an existing saved Mark with no home).

### Prototype asset for human review

[Integrated Course Detail / Course Map / Plan flow mockup](../prototypes/integrated-course-editing/index.html?variant=sheet-toast)
combines the accepted decisions from 02/03 (Route thread + map sheet), 04
(Mark-to-Mark Plan groups), 05 (no draft, immediate writes), and 06
(Mark-backed styling, Change Mark, promotion), and compares three
transition-and-reversal models: `sheet-toast` (bottom sheet + snackbar undo),
`full-log` (full-screen map + persistent change log), and `inline-row` (map
expands inline in Course Detail + row-local undo). See its
[run instructions](../prototypes/integrated-course-editing/README.md) for the
full walkthrough of what's exercised.
