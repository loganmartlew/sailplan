# 15 — Plan and inspect complete multi-Segment routes

**What to build:** A sailor planning any saved Course sees accurate guidance grouped by familiar Mark-to-Mark Legs, can orient on the complete read-only route, and can edit the owning Course before returning to visibly recalculated results.

**Blocked by:** 14 — Manage complex routed Courses safely.

**Status:** ready-for-agent

- [ ] One live Plan-route hook composes the current Course route, optional Plan-only endpoints, TWD, and per-Segment guidance with consistent loading and error semantics.
- [ ] Custom start and finish locations are explicit Plan endpoint values rather than fake negative-id Course Marks.
- [ ] A custom start or finish creates a synthetic null-id Leg containing one direct Segment and no saved Via Points; the standalone two-Mark Plan flow remains unchanged.
- [ ] Plan results group Segments beneath their enclosing Course-Mark-to-Course-Mark Legs.
- [ ] A direct Leg retains a familiar compact guidance presentation, while a multi-Segment Leg header contains no direct-line bearing, TWA, tack, or sail recommendation.
- [ ] Every Segment row shows guidance calculated from its actual endpoints and distinguishes local and Mark-backed Via Point endpoints.
- [ ] A point's note appears, clamped to one line, on the Segment that ends at that point; the first saved Course point's note appears on the first Leg header when no custom start Segment exists.
- [ ] Sail suggestions are calculated at the Segment-row layer from suggestion data loaded once for the screen and the current TWS.
- [ ] The Plan Map shows the complete saved route read-only, does not duplicate route-point notes, and offers an explicit Edit saved course action.
- [ ] Returning from a saved Course edit reloads the live route, recomputes all Segment guidance, and displays a clear recalculation banner.
- [ ] Saved Courses with fewer than two Course Marks and other non-calculable combinations show explicit empty states rather than appearing stuck or failed.
- [ ] Automated tests cover no custom endpoints, start only, finish only, both endpoints, incomplete Courses, direct and multi-Segment Legs, current Mark-backed coordinates, notes, direction ownership, and absence of Leg-level direct guidance.

