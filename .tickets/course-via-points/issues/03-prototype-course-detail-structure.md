# Prototype the Course detail structure and constrained reordering

Type: prototype
Status: resolved
Blocked by:

## Question

How should Course detail present Course Marks, Legs, and nested Via Points so that adding, reordering within a Leg, opening the Course Map, and explaining blocked Course Mark moves feel natural rather than restrictive?

Compare variants using zero, one, and several Via Points. The result must define how the list and Course Map hand off context to one another.

## Answer

- Use the **Route thread** structure: Course Marks are the vertical route anchors; each Mark-to-Mark Leg sits directly below its start Mark; Via Points and Leg Segments are visibly nested inside that Leg.
- Course Detail is the default route view. Its inline Course Map expands to a map sheet; there is no separate Course Map screen.
- The sailor selects a named **Leg Segment** before adding. Selection is visible in both the detail list and map, so overlapping geometry never requires guessing a line.
- **Add Via Point** opens one chooser: **Map pin** or **Existing Mark**. A Map pin focuses only the selected Leg, assigns a stable default name selected for replacement, and is placed one at a time. An Existing Mark becomes a Mark-backed Via Point in that selected segment.
- A Map-pin addition begun from Course Detail returns to Course Detail; one begun from the Course Map returns to that map sheet. Mark-backed Via Point names and coordinates are read-only and direct the sailor to the saved Mark editor.
- Course-local Via Points can be renamed, removed, reordered with explicit in-Leg controls, moved across a Course Mark only through an explicit separate flow, and relocated from either their detail-row map icon or their Course Map pin. These actions are available immediately—there is no Edit-route gate or draft Save/Cancel state.
- The expanded Course Map supports selecting named Leg Segments, adding through the same chooser, and moving course-local Via Point pins. It shows route shape only; it makes no navigability/safety claim and Via Points have no rounding direction.
- Course Mark reordering is visibly separate and reports that it is blocked while affected Legs contain Via Points, requiring an explicit resolution flow.

## Comments

- Prototype asset for human review: [Course detail structure mockup](../prototypes/course-detail-structure/index.html?variant=thread). It contains the three shareable layouts (`thread`, `decks`, and `canvas`); see its [run instructions](../prototypes/course-detail-structure/README.md).
- Human verdict: accepted after HITL iteration. The Route thread is the validated direction; Leg decks and Segment canvas were rejected. The later map-sheet refinement keeps the three variants as prototype evidence while defining the Route-thread baseline.
