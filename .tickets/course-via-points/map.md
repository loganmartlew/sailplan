# Course Via Points — Wayfinding Map

Type: map
Status: active

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

## Not yet specified

- Exact implementation acceptance criteria and implementation-ticket slicing depend on the UI and persistence decisions.
- Route serialization, query, and calculation changes cannot be specified until the persistence model is chosen.
- The detailed behavior for stale drafts or concurrent edits may emerge from the route-editor and persistence decisions.

## Out of scope

- Plan-local or one-use Via Points in version one; Plans consume the saved Course.
- Automatic ordering, shortest-path inference, or batch placement in version one.
- Inferring, validating, or advertising a route as navigable or safe.
- Automatic route generation around land, depth, weather, or exclusion zones.
- Production implementation as part of this wayfinding map.
