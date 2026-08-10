# Establish the Via Point domain and first-version boundary

Type: grilling
Status: resolved
Blocked by:

## Question

What is a Via Point in SailPlan, where does it belong, and what behavior is inside the first-version boundary?

## Answer

- A **Course Mark** is a reusable Mark acting as a Leg boundary. A **Via Point** is a directionless role inside a Leg that shapes its intended route around a known constraint.
- A Leg runs from one Course Mark to the next. Via Points split it into straight **Leg Segments**, each of which receives bearing, TWA, tack, and sail guidance.
- Via Points belong durably to the saved Course and are inherited by future Plans. Plan-local Via Points are deferred.
- A Via Point may hold course-local coordinates or reference a reusable Mark. Existing Marks can be used in the Via Point role without becoming Leg boundaries.
- Mark-backed Via Points follow changes to their saved Mark. Their coordinates and names are read-only in the Via Point interface. Referenced Marks cannot be deleted until all Course uses are resolved.
- A course-local Via Point can be promoted through the user-facing action **Add to saved marks**, supported by “Use this location in other courses.” Promotion does not change its Via Point role.
- Via Points have no port/starboard rounding direction. SailPlan records the sailor's intended route and does not assert navigability.
- Course Detail actions are available immediately; there is no Edit-route gate or UI draft/Save/Cancel state. The Course Map opens as an overview, with explicit add and move actions available there as well as from Course Detail.
- Addition is deterministic and one at a time: select the Leg Segment to split, then place the point. Automatic/batch ordering is deferred.
- Multiple Via Points are allowed within a Leg. Their automatic names are stable and unique across the Course; the default name is selected for immediate replacement after placement.
- Ordinary Via Point reordering stays within its parent Leg. Moving one across a Course Mark requires an explicit move flow. Course Mark reordering is blocked until affected Via Points are resolved.
- A Course Plan offers a read-only route map and an explicit path to edit the saved Course; it does not edit Via Points in place.

## Comments

Resolved during the initial `grill-with-docs` interview. The Plan-results grouping choice was deliberately left for a prototype ticket.

### Amendment — Course Detail / Course Map prototype

The accepted Course Detail prototype supersedes the original transactional-editor
interaction for this surface. This is a product interaction change, not a
persistence decision: implementation may choose its appropriate durable-write
mechanism, but it must not require the sailor to enter an Edit-route mode or
explicitly Save/Cancel before using a Via Point action.
