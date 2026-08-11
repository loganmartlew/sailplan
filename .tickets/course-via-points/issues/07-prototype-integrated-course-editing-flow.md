# Prototype the integrated Course Detail map-editing and Plan return flow

Type: prototype
Status: open
Blocked by: 02, 03, 04

## Question

What single, coherent interaction should connect the Course Detail structural
view, its Course Map spatial sheet, and read-only Course Plan results so that
Via Point work feels like one Course editor rather than three competing editors?

After the blocking prototype tickets have human verdicts, build a refined,
standalone HTML mobile prototype that combines those chosen decisions and
compares meaningfully different transition models. Exercise the complete flow:

- select a Leg Segment from Course Detail and open its Course Map sheet with
  that exact context;
- insert, name, move, reorder, or remove a course-local or Mark-backed Via Point
  as an immediate durable action — there is no draft and no Save/Cancel
  boundary ([05](05-choose-persistence-model.md)); show how each action is
  reversed instead;
- return between the map sheet and Course Detail without losing the shared
  selection context;
- explain a Course Mark move blocked by affected Via Points;
- save the Course, return to a read-only Course Plan, and show recalculated Leg
  Segment guidance grouped beneath sailor-recognised Mark-to-Mark Legs; and
- enter **Edit saved course** from the Plan Map and return to the same coherent
  editing flow.

The prototype must make the ownership boundary explicit: Course Detail owns the
saved Course and the one selection context; its Course Map sheet is that
Course's spatial representation, not a separate screen or independently saved
editor.

## Comments

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
this prototype compares are about **selection context and reversal**, not about
committing a draft. The brief has been corrected in place.
