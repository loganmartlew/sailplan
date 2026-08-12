# 16 — Navigate live Segment detail and complete integration

**What to build:** A sailor can open detailed analysis for one actual Leg Segment, retain its Mark-to-Mark Leg context, move among sibling Segments, and recover safely when a saved Course edit invalidates the selected Segment.

**Blocked by:** 15 — Plan and inspect complete multi-Segment routes.

**Status:** ready-for-agent

- [ ] Opening detail from a Segment row passes Plan identity, a saved or synthetic Leg reference, and Segment index rather than a serialized computed guidance snapshot.
- [ ] Segment detail resolves through the same live Plan-route hook and current Plan-store TWS used by Plan results.
- [ ] A compact enclosing-Leg banner names the two Course Marks and shows their actual rounding directions.
- [ ] The focused Segment shows both endpoints in route order, full unclamped endpoint notes, bearing, TWA, tack, and the existing sail-suggestion breakdown.
- [ ] Port or starboard appears only beside endpoints whose domain kind is Course Mark; Via Points and Plan-only endpoints never acquire a rounding instruction.
- [ ] The sailor can move to the previous or next Segment within the enclosing Leg without returning to Plan results.
- [ ] If the Leg or Segment can no longer be resolved after a saved Course edit, the screen returns to recalculated Plan results rather than displaying stale or empty detail.
- [ ] Loading, error, and empty behavior is explicit across Course Detail, Course Map, Plan results, Plan Map, and Segment detail.
- [ ] Feature dependencies remain one-way: Course owns durable wind-agnostic routes and Plan imports them to add transient endpoints and wind-derived guidance.
- [ ] Automated tests cover valid saved and synthetic identity resolution, sibling navigation bounds, current-data reload, full notes, direction rules, and stale/deleted Leg recovery.
- [ ] The final Android acceptance matrix passes for direct Courses, local and Mark-backed Via Points, complex edits and Undo, Course and Plan maps, Plan recalculation, and Segment-detail navigation.

