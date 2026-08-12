# Course Via Points

Type: spec
Status: ready-for-agent

## Problem Statement

Sailors currently define a Course only as an ordered list of Course Marks. That
works when every Leg can be treated as one straight line, but real routes often
need to pass outside a headland, avoid a known obstruction, or follow a channel
between two Course Marks. SailPlan cannot record that intended shape without
turning every intermediate location into a Course Mark, which incorrectly gives
the point a rounding role and changes the sailor-recognised Leg structure.

Because the route has no intermediate points, Course Plans also calculate one
bearing, TWA, tack, and sail suggestion for the direct Course-Mark-to-Course-Mark
line. Those values can describe a line the sailor does not intend to sail. The
Course editor, Course Map, Plan results, and Leg detail therefore need one
durable and consistent representation of intermediate Via Points and of the Leg
Segments they create.

## Solution

Allow a sailor to add ordered, directionless Via Points inside a saved Course's
Legs. A Via Point can be a course-local named coordinate or a live reference to
an existing saved Mark. Via Points shape the intended route without becoming
Course Marks, and each span between consecutive route points becomes a Leg
Segment with its own bearing, TWA, tack, and sail guidance.

Course Detail becomes a Route thread in which Course Marks remain the primary
Leg boundaries and Via Points are visibly nested within their parent Legs. Its
Course Map opens as a bottom sheet over the detail screen and provides the
spatial view of the same saved Course. Route edits are immediate, durable,
transactional actions with one-level snackbar Undo; there is no route edit mode
or draft Save/Cancel workflow.

Course Plan results remain organised by familiar Mark-to-Mark Legs, with lighter
rows for their Leg Segments. The Plan Map is read-only and links back to the
saved Course editor. Leg detail focuses one Leg Segment while retaining its
enclosing Mark-to-Mark Leg context.

## User Stories

1. As a sailor, I want to add a Via Point inside a Leg, so that my Course records the route I intend to sail rather than a misleading direct line.
2. As a sailor routing around land, I want to place a Via Point on the Course Map, so that I can shape the route spatially around a headland or peninsula.
3. As a sailor navigating a channel, I want to add several Via Points to one Leg, so that I can represent each turn through the channel.
4. As a sailor, I want Via Points to remain part of the saved Course, so that every future Plan for that Course inherits the intended route.
5. As a sailor, I want a Via Point to remain directionless, so that it does not imply a port or starboard rounding instruction.
6. As a sailor, I want the app to describe Via Points as route-shaping points rather than safety guarantees, so that I do not mistake the Course for validated navigation advice.
7. As a sailor, I want to insert a Via Point into a named gap between consecutive route points, so that I know exactly which Leg Segment it will split.
8. As a sailor, I want to add one Via Point at a time, so that its position and order are deliberate.
9. As a sailor, I want a newly placed local Via Point to receive a stable Course-unique default name selected for replacement, so that I can name it quickly without leaving it unidentified.
10. As a sailor, I want to rename a course-local Via Point, so that its name communicates the constraint or location it represents.
11. As a sailor, I want to relocate a course-local Via Point from its Route-thread row or map pin, so that I can correct the intended route shape.
12. As a sailor, I want a dropped or moved pin to be previewed before I confirm it, so that an imprecise map tap does not immediately change my Course.
13. As a sailor, I want map placement started from Course Detail to return me to Course Detail, so that I resume where I began.
14. As a sailor, I want map placement started from the Course Map sheet to leave me on that sheet, so that I can continue inspecting the route spatially.
15. As a sailor, I want the map to infer the nearest Leg Segment when I drop a new pin and name that inferred segment before confirmation, so that I can verify where the point will be inserted.
16. As a sailor, I want overlapping or nearby Legs to be identified by their endpoint names during insertion, so that ambiguous geometry does not silently place a Via Point in the wrong Leg.
17. As a sailor, I want to choose an existing saved Mark as a Via Point, so that I can reuse a known location without making it a Leg boundary.
18. As a sailor, I want the Existing Mark chooser to exclude the two Course Marks bounding the target Leg, so that I cannot add a geometrically meaningless duplicate of the Leg's endpoint inside that Leg.
19. As a sailor, I want all other saved Marks to remain selectable, including Marks already used elsewhere in the Course, so that out-and-back and repeated routes remain possible.
20. As a sailor, I want a Mark-backed Via Point to follow later changes to its saved Mark's name and coordinates, so that there is one live source of truth for that location.
21. As a sailor, I want Mark-backed Via Point names and coordinates to be read-only in the Course, so that I understand they are owned by the saved Mark.
22. As a sailor, I want local and Mark-backed Via Points to look distinct in the Route thread, maps, and Plan results, so that I can anticipate which points can be dragged or renamed.
23. As a sailor, I want to change which saved Mark backs a Mark-backed Via Point, so that I can correct the reference without changing the point's Leg, order, note, or identity.
24. As a sailor, I want linking to be one-way, so that a linked location has an unambiguous owner and repositioning it requires the deliberate act of replacing it with a local point.
25. As a sailor, I want to add a course-local Via Point to saved Marks, so that I can reuse that location in other Courses.
26. As a sailor promoting a Via Point, I want to edit the proposed Mark name while seeing its coordinates read-only, so that I can give the global Mark a useful name without accidentally moving the Course.
27. As a sailor, I want promotion to preserve the Via Point's role, Leg, order, note, and identity, so that saving the location does not restructure my Course.
28. As a sailor, I want promotion to succeed completely or leave both the Via Point and saved Marks unchanged, so that a failure cannot create an orphan Mark or a partially linked route.
29. As a sailor, I want Mark creation and Via Point promotion to use the same validation rules, so that duplicate names and other constraints behave consistently.
30. As a sailor, I want to reorder Via Points explicitly within their Leg, so that I can correct the sequence without imprecise drag gestures.
31. As a sailor, I want moving a Via Point across a Course Mark to be a separate explicit action, so that it cannot silently change which Leg owns the point.
32. As a sailor, I want Course Mark reordering blocked when affected Legs contain Via Points, so that changing the running order cannot silently re-parent route constraints.
33. As a sailor, I want a blocked Course Mark move to name the affected Legs and Via Points, so that I know what must be resolved first.
34. As a sailor deleting an interior Course Mark, I want its adjacent Legs merged and their Via Points retained in route order, so that removing a rounding does not discard or move the constraints around it.
35. As a sailor deleting the first or last Course Mark, I want confirmation to name how many Via Points will also be removed, so that I understand the consequence of destroying an outer Leg.
36. As a sailor, I want to remove a Via Point without deleting a saved Mark behind it, so that Course editing does not destroy reusable data.
37. As a sailor, I want each immediate route edit to offer a dismissible snackbar Undo, so that I can reverse my latest accidental action without maintaining a draft.
38. As a sailor, I want the Undo affordance to apply globally to the latest route edit, so that reversal remains predictable even when a point has been removed from the list.
39. As a sailor, I want Course Detail to show Course Marks as route anchors and Via Points nested inside their Mark-to-Mark Legs, so that the route reads like the Course I recognise.
40. As a sailor, I want direct Legs and Legs containing one or several Via Points to use the same Route-thread structure, so that the screen remains predictable as routes become more detailed.
41. As a sailor, I want the Course Map to open as a partial-height sheet over Course Detail, so that it clearly remains the spatial view of this Course rather than a separate editor.
42. As a sailor, I want to dismiss the Course Map by its close control, backdrop, or platform back action, so that it behaves like a conventional sheet.
43. As a sailor, I want the Course Map to show the complete route polyline and distinguish Course Marks, local Via Points, and Mark-backed Via Points, so that I can understand the route shape at a glance.
44. As a sailor, I want route writes to save immediately, so that leaving or backgrounding the screen cannot discard an uncommitted route draft.
45. As a sailor, I want to add a Course-scoped note to either a Course Mark or Via Point, so that I can record why the route passes that point or how it should be approached.
46. As a sailor, I want a route-point note limited to 200 characters, so that notes remain concise enough to display fully on detail screens.
47. As a sailor, I want whitespace-only notes treated as absent, so that empty note rows do not clutter the route.
48. As a sailor, I want notes shown beneath point names and clamped to one line in the Route thread, so that I can scan route intent without making each row excessively tall.
49. As a sailor, I want a route-point row tap to open its editor and a three-dot menu to hold secondary and destructive actions, so that notes and common edits fit on a mobile screen.
50. As a sailor, I want Via Point reorder controls to remain visible, so that repeated ordering changes stay efficient.
51. As a sailor, I want the selected Course Map pin to show its note, so that I can understand why a dogleg exists while viewing its location.
52. As a sailor, I want a saved Mark editor to show the Courses and roles that use the Mark, so that I understand the impact of changing its live name or position.
53. As a sailor, I want renaming or moving a used Mark to update its Course uses without repeated confirmation, so that linked points behave as live references.
54. As a sailor, I want deletion of a used Mark blocked, so that a Course cannot be left with a missing Course Mark or Mark-backed Via Point.
55. As a sailor, I want the blocked-delete dialog to name every affected Course and whether the Mark is a Course Mark or a Via Point in a particular Leg, so that I understand each dependency.
56. As a sailor, I want each affected Course in the blocked-delete dialog to be tappable, so that I can navigate directly to the place where the dependency can be resolved.
57. As a sailor planning a Course, I want every Leg Segment to receive bearing, TWA, tack, and sail guidance from its own endpoints, so that the values describe the lines I intend to sail.
58. As a sailor, I want a Mark-backed Via Point's latest saved coordinates used in Plan calculations, so that guidance follows edits to the underlying Mark.
59. As a sailor, I want no direct-line guidance on a multi-Segment Leg header, so that SailPlan does not present a bearing or TWA for a line I will not sail.
60. As a sailor, I want a Leg with no Via Points to retain the familiar single-segment guidance presentation, so that simple Courses do not become harder to read.
61. As a sailor, I want Plan results grouped by Course-Mark-to-Course-Mark Leg with lighter timeline rows for Segments, so that I retain familiar Course structure while seeing accurate detailed guidance.
62. As a sailor, I want local and Mark-backed Via Point endpoints distinguished in Plan results, so that their source remains understandable outside the editor.
63. As a sailor, I want a point's note shown on the Plan Segment that ends at that point, so that its instruction appears while approaching the relevant point.
64. As a sailor, I want the first Course point's note shown on the first Leg header when there is no incoming custom-start Segment, so that its note is not orphaned.
65. As a sailor, I want the Plan Map to show the complete saved route as read-only, so that I can orient myself without accidentally editing a Plan.
66. As a sailor, I want an explicit Edit saved course action from the Plan Map, so that route changes happen in the one Course editor that owns them.
67. As a sailor returning from a saved Course edit, I want Plan results recalculated and visibly identified as updated, so that I know the guidance reflects the new route.
68. As a sailor choosing a custom Plan start or finish, I want it represented as a Plan-only endpoint rather than a fake Course Mark, so that it cannot be mistaken for saved Course structure.
69. As a sailor, I want custom start and finish Legs to contain one direct Segment and no saved Via Points, so that Plan-only endpoints remain outside the version-one Course Via Point model.
70. As a sailor, I want to open detail from an individual Segment row, so that the detailed bearing, TWA, and sail analysis corresponds to one actual line sailed.
71. As a sailor viewing Segment detail, I want a compact banner naming the enclosing Leg's two Course Marks and their rounding directions, so that I retain Mark-to-Mark context.
72. As a sailor viewing Segment detail, I want the focused Segment's two endpoints and their full notes in route order, so that detailed guidance includes the relevant route intent without truncation.
73. As a sailor viewing Segment detail, I want port or starboard shown only beside actual Course Mark endpoints, so that Via Points never inherit a false rounding instruction.
74. As a sailor, I want to move between Segments of the same Leg from Segment detail, so that I can inspect the whole Leg without returning to Plan results after every Segment.
75. As a sailor, I want Segment detail to reload from current Course and Plan identity rather than a serialized guidance snapshot, so that edits made while the app is open cannot leave me viewing stale route data.
76. As a sailor, I want a deleted or merged Leg reference to return me to recalculated Plan results, so that the app does not display an empty or invalid Segment detail screen.
77. As a sailor, I want the Course Mark summary to remain a numbered list of Course Marks and rounding directions only, so that Via Points do not obscure the official running order.
78. As a sailor, I want Course list badges to continue counting Course Marks rather than every route point, so that a four-Mark Course remains recognisable as a four-Mark Course.
79. As a sailor, I want a Course with no calculable Legs to show a clear empty state, so that incomplete Course data does not look like a loading failure.

## Implementation Decisions

- Preserve the domain distinction among Course Mark, Via Point, Leg, and Leg
  Segment. A Course Mark is a reusable Mark acting as a Leg boundary. A Via
  Point is a directionless, Course-owned role inside exactly one Leg. A Leg
  Segment is the straight span between consecutive route points and is the only
  unit that receives bearing, TWA, tack, and sail guidance.
- Add a Leg-scoped Via Point table owned through the Leg's starting Course Mark.
  It stores a contiguous integer order within the Leg and either a saved Mark
  reference or the complete local name/latitude/longitude tuple. A database
  check constraint enforces exactly one of those representations. It also holds
  an optional Course-scoped note.
- Add an optional Course-scoped note to Course Marks. Do not add a note to the
  global saved Mark: a globally true Mark description has different ownership
  and presentation requirements.
- Cap both route-point note kinds at 200 characters. Reject input beyond the
  cap, show a remaining-character counter only for the final 30 characters,
  and normalise whitespace-only content to null.
- Keep Course Marks in their existing table. Do not unify Course Marks and Via
  Points into one globally ordered point table and do not materialise hidden
  saved Marks for local Via Points.
- Define Drizzle relations so a Course route can be loaded as ordered Course
  Marks with each Leg-start row's ordered Via Points. Enable SQLite foreign-key
  enforcement for the database connection.
- The migration creates the Via Point table and Course Mark note column, and
  removes existing orphaned Course Mark rows whose saved Mark no longer exists
  before foreign-key enforcement is enabled. Existing Course Mark identities
  and ordering remain intact.
- Fix Course Mark insertion so an existing maximum order of zero produces order
  one. Move all route ordering writes behind the Course route module.
- Expose one intent-oriented Course route module for reads and transactional
  writes. Every user intent is an immediate durable transaction; React
  components do not compose multi-row route writes themselves.
- Keep integer Via Point order contiguous within each Leg without a unique
  index. The route module is the only writer, and reads sort by order then id so
  malformed ties degrade deterministically.
- Map nullable database rows to a discriminated route-point union before they
  leave the Course module: Course Mark, local Via Point, or Mark-backed Via
  Point. All variants expose resolved names and coordinates; only Course Marks
  expose direction, and both Course-owned point kinds expose notes.
- Return a Course route read model containing its flattened points, ordered
  Mark-to-Mark Legs, each Leg's Via Points, and derived Leg Segments. Derive
  Segments once in the mapper so Course Detail, both maps, Plan results, and Leg
  detail share endpoints, ordering, keys, and indices.
- Retain the existing Course-Mark-only query for callers that genuinely need
  Marks rather than routes: Course list counts and the custom start/finish
  location picker. Route-aware Course Detail and Plan results use the new route
  read model.
- Preserve multiple occurrences of the same saved Mark. The Existing Mark and
  Change Mark choosers exclude only the two Course Marks bounding the target
  Leg and otherwise remain flat name lists consistent with current Mark
  selection.
- Treat Mark-backed Via Points as live references. Their name and coordinates
  resolve from the saved Mark and are read-only in the Via Point editor. Change
  Mark replaces the reference in place; detaching back to a local point is not
  supported.
- Promote a local Via Point through Add to saved marks. The confirmation allows
  editing the new Mark name, displays coordinates read-only, and applies the
  same validation as ordinary Mark creation. The Mark insert and Via Point
  conversion occur in one transaction while preserving Via Point id, Leg,
  order, and note.
- Distinguish Course Marks, local Via Points, and Mark-backed Via Points in the
  Route thread and maps; distinguish local and Mark-backed Via Point endpoints
  in Plan results. Mark-backed map pins do not respond to drag.
- Reorder Via Points only within their parent Leg through explicit controls.
  Moving one across a Course Mark changes its Leg foreign key through a separate
  explicit flow. Block Course Mark reorder whenever the move would affect Legs
  containing Via Points, and identify what must be resolved.
- Deleting an interior Course Mark merges the adjacent Legs and concatenates
  their Via Points in route order. Deleting an outer Course Mark destroys its
  single adjacent Leg and requires confirmation naming the Via Points that will
  be deleted. Deleting a Via Point never deletes its referenced saved Mark.
- Guard saved Mark deletion in the application by finding use across both
  Course Marks and Mark-backed Via Points, and rely on foreign keys as the
  integrity backstop. The blocked dialog groups/names Course uses and roles and
  links each entry to Course Detail. The Mark editor shows a passive Used by N
  courses link; ordinary Mark edits remain immediate without an impact prompt.
- Present Course Detail as the accepted Route thread: Course Marks are anchors,
  each Mark-to-Mark Leg sits beneath its start Mark, Via Points are nested
  inside the Leg, and tappable insertion gaps appear between consecutive route
  points. Tapping a point row edits it; a three-dot menu contains secondary and
  destructive actions; Via Point reorder controls remain visible.
- Use one Add Via Point chooser with Map pin and Existing Mark actions. An
  Existing Mark selection commits immediately. A Map pin receives a stable,
  Course-unique default name and requires placement preview plus explicit
  confirmation.
- Do not maintain a persistent selected Segment. Route-thread insert rows carry
  their gap for the life of the add action. A free placement begun in the map
  infers the nearest Segment, names the inferred endpoint pair before
  confirmation, and shows amber only for the pending pin.
- Keep the nearest-Segment/map-gap interaction isolated behind the add intent so
  the provisional interaction can be replaced without changing persistence or
  the route read model.
- The Course Map is a partial-height bottom sheet layered over Course Detail,
  opened from a collapsed inline preview. It uses the same live Course route and
  pending action as the underlying screen, not a separate navigation
  destination or edit draft.
- All non-spatial route actions commit on the gesture that expresses them.
  Provide one global, dismissible snackbar Undo for the latest route edit. A
  newer action or dismissal retires the previous undo; there is no persistent
  history or per-row undo state.
- Build Plan routes explicitly from the saved Course route plus optional start
  and finish locations. Remove negative-id pseudo Course Marks. A Plan endpoint
  is its own route-point kind with no persisted id or direction; synthetic
  start/finish Legs have a null Leg id, one Segment, and no Via Points.
- Add a pure Plan-route pipeline that builds Plan-only endpoints and attaches
  bearing and TWA/tack to each Segment from its actual endpoint coordinates.
  Leg objects contain no direct-line bearing or TWA. Sail suggestions remain at
  the Segment-row layer, using suggestion data loaded once for the screen and
  the current TWS.
- Provide one Plan-route hook that composes the live Course route, Plan route
  builder, and guidance computation. TWD is an explicit input. Plan results and
  Segment detail use the same hook and loading/error semantics.
- Group Plan results by Mark-to-Mark Leg. A direct Leg may surface its sole
  Segment guidance in the familiar header presentation; a multi-Segment Leg
  header contains identity and route summary only, with lighter timeline rows
  for each Segment's bearing, TWA, tack, and sail call.
- Show a route-point note, clamped to one line, on the Plan Segment ending at
  that point. If the saved Course's first point has no incoming Segment because
  there is no custom Plan start, show its note in the first Leg header. Do not
  duplicate notes on the read-only Plan Map.
- Keep the Plan Map read-only and add Edit saved course. Returning after any
  Course change reloads the route, recomputes all Segment guidance, and shows a
  recalculation banner. Course Detail owns all route editing.
- Replace the serialized computed Course-leg snapshot with a route contract
  containing the existing Plan identity, a Leg reference, and Segment index.
  Use the starting Course Mark id for saved Legs and explicit start/finish
  sentinels for synthetic Legs. Do not change the standalone two-Mark Plan
  contract.
- Segment detail focuses one Leg Segment. It includes a slim enclosing-Leg
  banner with the two bounding Course Marks, the focused Segment's endpoint
  labels, full unclamped endpoint notes, bearing/TWA/tack, and the existing sail
  suggestion breakdown. Direction badges render only for endpoints whose union
  kind is Course Mark.
- Support moving to another Segment within the enclosing Leg. The exact
  previous/next versus position-dot control may be chosen during implementation
  without changing the data or navigation contract.
- If Segment detail cannot resolve its Leg reference after a saved Course edit,
  return to Plan results so the recalculated route can be selected. TWS is read
  from the current Plan store instead of serialized in the route parameter.
- Keep the Course Mark summary numbered and Course-Mark-only, including its
  direction badges. Keep Course list counts defined as the number of Course
  Marks, not total route points.
- Provide explicit loading, error, and empty states. A saved Course with fewer
  than two Course Marks has no saved Legs; custom Plan endpoints may still
  create a synthetic Leg where applicable.
- Preserve feature-slice dependency direction: the Course feature owns durable,
  wind-agnostic route data and edit intents; the Plan feature imports that
  model to add transient endpoints and wind-derived guidance; Course never
  imports Plan.

## Testing Decisions

- Tests assert externally observable route behaviour rather than database row
  mechanics, React component structure, hook call counts, or styling classes.
  A good test supplies a stored-route-shaped fixture and an intent or Plan input,
  then checks the resulting Course/Plan route, errors, and guidance a sailor can
  observe.
- Use one highest practical automated seam: the public pure route pipeline that
  maps stored Course data into the domain route, plans/applies route-edit
  intents, builds the Plan route, and computes per-Segment guidance. Keep SQLite
  execution thin so the same intent plans exercised by tests are executed by
  transactions in production.
- Cover local and Mark-backed mapping, multiple Via Points and repeated saved
  Marks, deterministic ordering, Segment derivation, and flattened map points.
- Cover insertion into every gap, in-Leg reorder, explicit cross-Mark movement,
  blocked Course Mark reorder, interior-mark merge, outer-mark deletion, note
  preservation, Change Mark, promotion, and one-step inverse/Undo outcomes.
- Cover invariant and failure behaviour: invalid local/reference combinations,
  excluded Leg-boundary Marks, transaction-safe promotion, Mark usage across
  both roles, blocked deletion, and no partial route mutation after a rejected
  intent.
- Cover Plan construction with no custom endpoints, custom start, custom finish,
  both endpoints, empty/incomplete Courses, and null-id synthetic Legs.
- Cover guidance for every Segment using endpoint-specific coordinates,
  including live Mark-backed coordinates, TWA/tack edge cases, absence of
  Leg-level direct guidance, and direction only on Course Mark endpoints.
- Cover identity resolution for Segment detail, including a valid focused
  Segment and a stale/deleted Leg reference that requires returning to Plan
  results.
- Follow existing prior art by colocating plain Jest `*.test.ts` suites beside
  pure utilities and using small fixture factories, as used by bearing/TWA,
  polar interpolation, and sail-suggestion tests. Reuse the existing bearing
  and TWA functions rather than retesting their internal formula through every
  route scenario.
- Verify UI behaviour manually on an Android device or emulator because the
  repository has no component-render or end-to-end test harness. Exercise zero,
  one, and several Via Points; local and Mark-backed points; overlapping Legs;
  insertion from the Route thread and Course Map; pin confirmation/cancellation;
  one-level Undo; note clamping/full display; blocked reorder/deletion; Plan
  recalculation; and Segment-detail navigation.
- Run the normal lint, TypeScript-aware build checks available to the project,
  and Jest suite. Report device/emulator verification separately and do not
  infer runtime success from static checks.

## Out of Scope

- Plan-local or one-use Via Points, including Via Points on custom Plan
  start/finish Legs.
- Automatic or batch Via Point ordering, automatic shortest-path routing, and
  automatic generation around land, depth, weather, exclusion zones, or other
  hazards.
- Validating, certifying, or advertising the recorded route as navigable or
  safe.
- Giving Via Points port/starboard rounding direction or inheriting Course Mark
  directions onto interior Segment endpoints.
- Detaching a Mark-backed Via Point into a local Via Point. The supported path
  is remove and re-add locally.
- Editing Via Points directly in Course Plan results or on the read-only Plan
  Map.
- A standalone Course Map/editor screen, a persistent route draft, route-level
  Save/Cancel, unlimited undo history, or per-row undo controls.
- Notes on the global saved Mark itself and the Mark-list/editor presentation
  such a global note would require.
- Changing the custom start/finish location picker into a full route preview;
  it remains Course-Mark-based.
- Changing the standalone two-point Plan-a-leg flow or its serialized data
  contract.
- A second Mark-to-Mark Leg-detail overview screen. Plan results provide the Leg
  overview; detail focuses a Segment.
- Choosing between the accepted previous/next and position-dot controls for
  switching Segments inside detail; that is an implementation-level choice.
- Wind-direction uncertainty itself. The Segment detail layout must remain
  compatible with that separately specified feature, but this effort does not
  implement or redefine it.

## Further Notes

- The normative domain terminology is Course Mark, Via Point, Leg, and Leg
  Segment. Avoid “boundary” for a Via Point and avoid “sub-leg” or “route
  segment” for a Leg Segment.
- Persistence and route ownership follow ADR-0001, Course route-point
  persistence. The ADR records the rejected schema alternatives and migration
  consequences behind this spec.
- The Route-thread insertion row and nearest-Segment map inference are accepted
  provisional interactions. Revisit them only if usability work shows that a
  gap row is mistaken for an on-water route element or that crossing/nearby
  Segments remain ambiguous despite naming the inferred endpoints before
  confirmation.
- The completed Wayfinder prototypes are decision evidence, not production
  assets. The accepted variants are the Route thread, partial-height Course Map
  with snackbar Undo, Mark-to-Mark Plan groups, route-point note rows, and
  Segment-focused Leg detail with its Leg-bounds banner.
