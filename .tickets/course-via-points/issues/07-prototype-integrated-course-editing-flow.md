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
  while preserving one shared edit draft and one Save/Cancel boundary;
- return between the map sheet and Course Detail without losing selection or
  draft state;
- explain a Course Mark move blocked by affected Via Points;
- save the Course, return to a read-only Course Plan, and show recalculated Leg
  Segment guidance grouped beneath sailor-recognised Mark-to-Mark Legs; and
- enter **Edit saved course** from the Plan Map and return to the same coherent
  editing flow.

The prototype must make the ownership boundary explicit: Course Detail owns the
single Course draft; its Course Map sheet is that draft's spatial
representation, not a separate screen or independently saved editor.

## Comments

- HITL direction: do not retain a standalone Course Map destination. The map is
  opened from Course Detail for read-only orientation or explicit draft editing,
  including dropping a Via Point pin on the map during placement.
