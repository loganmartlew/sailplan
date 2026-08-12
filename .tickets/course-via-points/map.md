# Course Via Points — Wayfinding Map

Type: map
Status: resolved

## Destination

An implementation-ready product and technical specification for durable Course Via Points, the Course Map/editor, and their presentation in Course Plans. Reaching the destination means no material product, interaction, domain, persistence, or migration decision remains for implementation to invent.

## Notes

- Primary use: shape a Course around land, headlands, peninsulas, and through channels.
- Read [`CONTEXT.md`](../../CONTEXT.md) before working any ticket; Via Point, Course Mark, Leg, and Leg Segment have deliberately distinct meanings.
- Use `grilling` and `domain-modeling` for decision interviews. Use `prototype` for UI tickets and `codebase-design` when choosing the persistence seam.
- This map plans decisions only. Production implementation begins after the destination is reached.
- Treat the resolved foundation ticket as the source of truth for decisions from the initial design interview.

## Decisions so far

- [Establish the Via Point domain and first-version boundary](issues/01-establish-via-point-domain.md) — Via Points durably shape saved Courses, may be local or Mark-backed, split Legs into Leg Segments, and are edited explicitly without claiming navigational safety.
- [Prototype the Course detail structure and constrained reordering](issues/03-prototype-course-detail-structure.md) — Use the Route thread and its integrated map sheet: explicit named Leg Segment selection, one chooser for local-map-pin or Existing-Mark additions, direct local-pin relocation, constrained in-Leg reordering, and immediate actions without an Edit-route gate.
- [Prototype Via Points in Course Plan results](issues/04-prototype-plan-presentation.md) — Plan results group guidance beneath Mark-to-Mark Legs, use lighter Segment timeline rows, and retain a read-only Plan Map with an explicit saved-Course edit and recalculation return path.
- [Choose the Course route-point persistence model](issues/05-choose-persistence-model.md) — A Leg-scoped `courseViaPoint` table owned by the Leg's start `courseMark` (unchanged), local-or-Mark-backed in one row under a CHECK, contiguous per-Leg ordering, and immediate durable writes with no draft, all behind one intent-based route module. Recorded as [ADR-0001](../../docs/adr/0001-course-route-point-persistence.md).

- [Decide saved-Mark linking and promotion behavior](issues/06-decide-saved-mark-transition-behavior.md) — The chooser hides only the Leg's own bounding Course Marks and stays a flat name list; **Add to saved marks** opens a name-editable confirm sheet validated exactly like Mark creation (so duplicate names save silently) and commits in one transaction; linking is one-way with **Change Mark** but no detach, Mark-backed points are visually distinct and silently undraggable; blocked Mark deletion names each Course and its role, tappable.

- [Specify the route read model, Plan calculation, and leg-data serialization](issues/09-specify-route-query-and-plan-calculation.md) — `useCourseRoute` returns a mapped `CourseRoute` (union route points, Legs, derived Segments, flat `points`); `useCourseMarks` survives for the count badge and the location picker; the `id: -1` start/finish trick is replaced by `buildPlanRoute` with `planEndpoint` points and `legId: null` Legs; pure `computeRouteGuidance({ route, twd })` puts bearing/TWA on Segments only, sail suggestion stays at the row; Leg detail takes `{ planData, legRef, segmentIndex }` instead of a serialized snapshot, so `courseLegDataSchema` is replaced; direction renders only on Course Mark endpoints.

- [Prototype the Leg detail screen under multi-Segment Legs](issues/10-prototype-leg-detail-multi-segment.md) — Leg Detail focuses one Leg Segment, reached from its Plan row; a Leg-bounds banner preserves Mark-to-Mark context, and the existing `{ legRef, segmentIndex }` contract supplies the focused Segment and enclosing Leg.

- [Decide Via Point and Course Mark notes](issues/08-decide-route-point-notes.md) — Both route point kinds carry a Course-scoped `note` (capped at 200 chars) on the course-point row, following the `courseMark.direction` precedent; the saved `mark` gets none. It renders clamped to one line under the point name in the Route thread, on the selected Course Map pin, and on the Leg Segment row that *ends* at that point in Plan results (Leg 1 header for the course's first point), and in full on Leg detail. Both row types move to tap-to-edit plus a `⋯` menu holding remove.

## Not yet specified

None. The decision route is complete; implementation acceptance criteria and work slicing are the next, separate planning activity.

## Out of scope

- Plan-local or one-use Via Points in version one; Plans consume the saved Course.
- Automatic ordering, shortest-path inference, or batch placement in version one.
- Inferring, validating, or advertising a route as navigable or safe.
- Automatic route generation around land, depth, weather, or exclusion zones.
- Production implementation as part of this wayfinding map.
- A note on the saved `mark` itself — global, true in every Course ("hard to see against the trees"). Ruled out while deciding [route point notes](issues/08-decide-route-point-notes.md): it is a separate feature with its own surfaces (Mark editor, Mark list) and its own merge rule against the Course-scoped note. Route point notes stay Course-scoped, on the course-point row.
