# Prototype the Course Map and route-editing interaction

Type: prototype
Status: resolved
Blocked by:

## Question

What Course Map interaction makes viewing the complete route and explicitly inserting, naming, moving, deleting, and saving course-local or Mark-backed Via Points feel clear on a mobile screen, including when Legs overlap geographically?

The prototype must compare meaningfully different UI variants on one throwaway route and exercise Courses with no Via Points, a headland detour, a multi-point channel, and overlapping Legs. It must preserve the resolved constraints in [Establish the Via Point domain and first-version boundary](01-establish-via-point-domain.md).

## Answer

Do not create a standalone Course Map/editor screen. It duplicates the route
context already owned by Course Detail and made the interaction feel like a
separate, purposeless editor.

Course Detail owns the one saved Course. Its Course Map sheet is the
spatial view for read-only orientation and explicit editing. Adding a Via Point
can start from either surface and place a pin on the map; Course Detail and its
map sheet share **one saved Course and one pending action**, with no selection
held between gestures ([07](07-prototype-integrated-course-editing-flow.md)).
The integrated
Course-Detail/map/Plan flow is specified and prototyped by
[07 — integrated Course Detail map-editing and Plan return flow](07-prototype-integrated-course-editing-flow.md).

## Comments

- Human verdict: reject the standalone Course Map/editor direction. The
  throwaway asset remains as primary-source evidence only; do not promote or
  iterate it as a product screen.

### Amendment — draft language superseded by ticket 05

This answer originally said "Save and Cancel remain boundaries for the shared
draft". [05](05-choose-persistence-model.md) settled that route writes are
immediate and durable — one transaction per intent, no draft state — which is
also what ticket 01's amendment and prototype 03 require. The shared thing
between Course Detail and its map sheet is the **saved Course itself**, not a
draft. The answer above has been corrected in place.

(This amendment originally said the shared thing was the "selection context".
[07](07-prototype-integrated-course-editing-flow.md) removed selection modes
entirely; the only thing now handed across the boundary is a single pending
action's target, and only while that action is in flight.)
