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

Course Detail owns the one saved-Course draft. Its Course Map sheet is the
spatial view for read-only orientation and explicit editing. Adding a Via Point
starts from Course Detail's selected context, then places a pin on the map;
Save and Cancel remain boundaries for the shared draft. The integrated
Course-Detail/map/Plan flow is specified and prototyped by
[07 — integrated Course Detail map-editing and Plan return flow](07-prototype-integrated-course-editing-flow.md).

## Comments

- Human verdict: reject the standalone Course Map/editor direction. The
  throwaway asset remains as primary-source evidence only; do not promote or
  iterate it as a product screen.
