# Decide Via Point and Course Mark notes

Type: grilling
Status: open
Blocked by: 05

## Question

Should route points carry a free-text note recording the sailor's intent
("stay outside the reef", "only if the tide is running"), and if so: do Course
Marks carry one as well as Via Points, where does it surface in the Route
thread, and does it reach Course Plan results?

The persistence half is already settled — [05](05-choose-persistence-model.md)
records `note` as an optional text column on `courseViaPoint`, meaningful to
both course-local and Mark-backed points, and a nullable column is the one
migration SQLite adds cheaply, so nothing is reserved by deferring. A note is
Course-scoped *intent*, which is why it sits on the route point rather than on
the saved Mark: the same Mark used in two Courses may warrant different notes.

What is undecided is product:

- **Symmetry.** `courseMark` has no note either, and in the Route thread both
  render as rows in the same list. Notes on Via Points alone would read as an
  arbitrary gap the first time a sailor tries to annotate a rounding.
- **Route thread placement.** Prototype [03](03-prototype-course-detail-structure.md)
  chose the Route thread without a note in it.
- **Plan results.** Prototype [04](04-prototype-plan-presentation.md)
  deliberately made Leg Segment rows *lighter* than cards — bearing, TWA, tack,
  sail. A note would be the first non-computed thing wanting a place there, and
  it is arguably the most valuable thing to see mid-race.
- **Row crowding.** Adding a note is what tips a Via Point row past the point
  where rename, relocate, remove, reorder, and **Add to saved marks** can all be
  visible controls. Whether the row's action set moves behind a 3-dot overflow
  menu is part of this same conversation, not a separate one.

Finish the session by asking whether a prototype is wanted before this
resolves — the honest question is how a note and its actions fit on a crowded
mobile row, and both surfaces it touches already have prototypes to extend.
