# Specify the route read model, Plan calculation, and leg-data serialization

Type: grilling
Status: open
Blocked by: 05

## Question

With the persistence model chosen, what exactly do the route read model and the
Plan calculation become — how is a Course read into Marks, Legs, and Leg
Segments, how does the Plan compute per-Segment guidance, and what happens to
the serialized leg data passed between screens?

Now specifiable because [05](05-choose-persistence-model.md) fixed the shape.
Concrete surfaces to settle:

- **The read model.** `useCourseRoute(courseId)` replaces or wraps
  `useCourseMarks` for route-aware callers. What does it return, and do the
  non-route callers (`CourseListItem`'s mark count, `PlanCourse`'s picker) keep
  using `useCourseMarks` or move over?
- **Custom start and finish.** `app/(plan)/course/plan.tsx` synthesizes pseudo
  Course Marks with `id: -1` / `-2` and out-of-range `order` values, then pairs
  consecutive marks into Legs. Those synthetic Legs have no Via Points. Does the
  same trick survive, or does the Plan take an explicit start/finish input into
  a route-building function?
- **Segment computation.** Bearing, TWA, tack, and sail suggestion are currently
  computed per Leg. Per Segment they must be computed from Segment endpoints —
  where a Mark-backed Via Point contributes its saved Mark's live coordinates.
  Where does that computation live, and is it a pure function over the route
  read model?
- **Serialization.** `courseLegDataSchema` (`from`/`to` marks, bearing, TWA,
  tws) and `legPlanDataSchema` are serialized into router params for the leg
  detail screens. A Leg is now a group of Segments — does the leg detail screen
  receive a Leg with its Segments, a single Segment, or something else, and does
  either Zod schema change shape?
- **Rounding direction.** Course Marks carry `direction`; Via Points never do.
  Confirm how a Segment boundary reports direction when its endpoint is a Via
  Point.

Prototype [04](04-prototype-plan-presentation.md) already fixed the
*presentation* (Mark-to-Mark groups, lighter Segment timeline rows, read-only
Plan Map with an **Edit saved course** path). This ticket is the data flow
underneath it, not the layout.
