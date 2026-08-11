# Specify the route read model, Plan calculation, and leg-data serialization

Type: grilling
Status: resolved
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

## Answer

### The route read model

`useCourseRoute(courseId)` returns a **mapped domain route**, not raw rows. A
pure mapper in `features/course/util/` turns the nested Drizzle result into:

```ts
type RoutePoint =
  | { kind: 'courseMark'; courseMarkId; markId; name; latitude; longitude;
      direction: 'port' | 'starboard' | null }
  | { kind: 'localVia'; viaPointId; name; latitude; longitude; note }
  | { kind: 'markBackedVia'; viaPointId; markId; name; latitude; longitude; note }

type RouteSegment = { key: string; from: RoutePoint; to: RoutePoint; indexInLeg: number }

type RouteLeg = {
  legId: number          // the Leg's start courseMark.id
  index: number
  start: RoutePoint; end: RoutePoint
  viaPoints: RoutePoint[]
  segments: RouteSegment[]   // always >= 1
}

type CourseRoute = { courseId: number; points: RoutePoint[]; legs: RouteLeg[] }
```

Nullable columns never escape the module (ADR-0001), so local vs Mark-backed is
a `kind` test rather than a `markId === null` check, and names and coordinates
are already resolved.

**Segments are part of the read model.** "A Leg Segment is the span between
consecutive route points" is a domain rule (CONTEXT.md) that would otherwise be
re-implemented in Plan results, the Course detail Route thread, the Course Map,
and the Plan Map — four chances to disagree about endpoints, ordering, or the
Segment `key` that ticket 03's explicit Segment selection depends on. Deriving
it once in the pure mapper is exactly the `features/course/util/` seam ADR-0001
asked for. The duplication between `viaPoints` and `segments` cannot drift
because the read model is immutable query output.

**`points`** — the whole route flattened in order — earns its place because both
maps draw one polyline; reconstructing it from `legs` means de-duplicating
shared Mark endpoints at every call site.

### Non-route callers keep `useCourseMarks`

`useCourseMarks` survives unchanged. `CourseMarks.tsx` and
`app/(plan)/course/plan.tsx` move to `useCourseRoute`; the other two do not:

- **`CourseListItem`** — the "N marks" badge counts Course Marks, which is the
  honest number: a Course with 4 Marks and 6 Via Points is still a 4-Mark
  course. Loading the full nested route per list row to derive a count we
  already have is a straight regression.
- **`PlanCourse`** — `mapMarks` is typed `Mark[]` and feeds `CustomLocation`'s
  picker map. A course-local Via Point is not a `Mark`, so moving means widening
  the prop and teaching that map two pin kinds, for a screen whose job is "pick
  where you start". Accepted consequence: that picker map draws straight lines
  between Marks, so a course threaded around a headland looks unlike its real
  shape there. It is a location picker, not a route preview — the Plan Map after
  calculation is where the real shape belongs.

### Custom start and finish — explicit route building

The `id: -1` / `id: -2` pseudo-Course-Mark trick is **removed**, along with its
`courseMarks[0].order - 1` arithmetic. `useCourseRoute` returns only the saved
Course; a pure `buildPlanRoute({ route, startLocation, finishLocation }):
PlanRoute` prepends and appends synthetic Legs.

- Plan endpoints are a fourth `RoutePoint` kind — **`planEndpoint`**: name,
  latitude, longitude, no id, `direction` absent.
- Synthetic Legs carry **`legId: null`** and exactly one Segment.
- An endpoint chosen from a saved Mark (`PlanCourse` resolves it via `getMark`)
  is still a `planEndpoint`, **not** a Mark-backed point. It is an endpoint of
  this Plan, not a member of the Course.

Under a discriminated union, the old trick would mint a `courseMark` point whose
`courseMarkId`/`markId` are `-1` and refer to no row — a value that lies about
its own kind, forcing every consumer to know the magic numbers. With ticket 04's
**Edit saved course** path and ticket 03's selectable Segments, `legId: null`
states structurally that a Leg is not part of the saved Course and has nothing
to edit, where `id < 0` would be a special case in each consumer.

Synthetic Legs hold **no Via Points** in this version: ADR-0001 owns Via Points
by a leg-start `courseMark` row, and Plan-local Via Points are out of scope on
the map. Extending Via Points to the start/finish Legs is anticipated later —
reusing the `RouteLeg` shape makes that a permission change, not a reshape.

### Segment computation

`computeRouteGuidance({ route: PlanRoute, twd }): GuidedRoute` — pure, in
`features/plan/util/`, no React and no SQLite — attaches `{ bearing, twa }` to
every Segment, computed from **that Segment's own two endpoints**, whatever
kind they are. Because the read model resolves a Mark-backed Via Point to its
Mark's live coordinates at query time, Plan results follow a Mark edit on the
next live-query tick with no extra machinery.

**Sail suggestion stays at the row**, as today: `useSailSuggestions` (a thin
`useMemo` over pure `suggestSails`) with `suggestionData` loaded once and
threaded down, and `tws` read from the plan store at the row. Folding
suggestions into the route computation would weld two different lifecycles —
`suggestionData` loads asynchronously per boat profile, so the entire route's
geometry would recompute when polar data arrives or the profile switches — and
would give a geometry function a dependency on the `sailSuggestion` feature.

### No Leg-level guidance

`GuidedLeg` has **no** `bearing` or `twa`. Guidance exists only on Segments.

- A Leg with no Via Points has exactly one Segment; its group header renders
  `segments[0]`, visually equivalent to today's `CourseLegCard`.
- A Leg with Via Points shows only Mark-to-Mark identity in its header.

A direct Mark-to-Mark bearing across a Leg threaded around a headland is a
heading nobody sails, with a wrong TWA and a wrong sail call — and printing it
in the same header slot where a Via-Point-free Leg prints a real heading is a
hazard, not just noise. Any future "overall this Leg is a beat" summary should
be an aggregate over Segments, never a straight line.

### Serialization — identity, not computed data

`courseLegDataSchema` is **replaced**, not grown. Leg detail
(`app/(plan)/course/leg.tsx`) receives:

```
{ planData, legRef, segmentIndex }
```

where `planData` is the `CoursePlanData` the Plan screen already holds
(courseId + start/finish) and `legRef` is a `courseMark` id or a
`'start'`/`'finish'` sentinel for a synthetic Leg. The screen recomputes through
the same chain and renders.

- Every field the route model gains — ticket 08's notes, ticket 06's
  local-vs-Mark-backed distinction, whatever [10](10-prototype-leg-detail-multi-segment.md)
  decides the screen shows — would otherwise have to be threaded through a Zod
  schema and a serializer purely for transport. The param contract is fixed now
  and stops changing.
- A serialized snapshot goes stale: Expo Router params survive backgrounding and
  ADR-0001 made route writes immediate and durable, so a sailor can sit on Leg
  detail, take the Edit-saved-course path, move a Via Point, and return to
  guidance for a Segment that no longer exists.
- **Cost accepted**: the screen gains a loading state and a **not-found** state
  (a deleted Course Mark merges two Legs, so `legRef` can match nothing).
  Not-found **pops back to Plan results** rather than rendering empty — a Plan
  whose route changed needs recalculating anyway.
- **Behaviour change**: `tws` no longer rides in the param. It comes from the
  plan store, so a Plan pushed at one wind speed reflects the store's current
  value when read later. This is correct, and it is a change.
- **`legPlanDataSchema` is untouched.** It serves `/leg/plan` and `/leg/map`
  pushed from `PlanLeg` — the standalone two-Mark planner, which has no Course,
  no Legs, and no Via Points.

The contract deliberately carries **both** the Leg (`legRef`) and the focused
Segment (`segmentIndex`), so the layout decision in ticket
[10](10-prototype-leg-detail-multi-segment.md) — whether Leg detail shows one
Segment or the whole Leg with one focused — can land either way without
changing these params.

### Rounding direction

Direction renders **exactly where the endpoint is a `courseMark` with a non-null
`direction`, and nowhere else**. No inheritance onto interior Segment
boundaries, no placeholder, no dash. In a three-Segment Leg from *Harbour (S)*
to *Point (P)*: Segment 1's `from` shows "Harbour S", Segment 3's `to` shows
"Point P", the four interior endpoints show a bare name. `planEndpoint` has no
direction, matching today's `direction: null` synthetics.

Inheriting the Leg's direction onto interior Segments was rejected: an "S" beside
a Via Point asserts you round that point to starboard — precisely the
navigational claim ticket 01 says a Via Point does not make — and the sailor
cannot tell an inherited letter from a real one.

Consequence: `MarkLabel` (`app/(plan)/course/leg.tsx`) and `MarkTitle`
(`CourseLegCard`) take a `RoutePoint` and render the letter only for the
`courseMark` kind. The letter's presence becomes a type-driven fact rather than
a null check.

### Assembly — one hook

`usePlanRoute(planData, twd)` in `features/plan/hooks/` wires
`useCourseRoute` → `buildPlanRoute` → `computeRouteGuidance` once and returns
`{ data: GuidedRoute | undefined, isLoading, error }`. **`twd` is an explicit
argument**, not read from the plan store inside the hook, so the hook's inputs
stay visible and a caller wanting a route at another wind direction has a
sensible path.

Both Plan results and Leg detail use it. Duplicating the assembly would
duplicate the loading rule and the `twd` default in two places that must agree
exactly — Leg detail resolving `legRef` against a differently-built route is how
a Leg that exists reports not-found.

### `CourseMarkListDialog`

Unchanged in substance: still a numbered 1..n list of Course Mark names with
direction badges, now fed the route's `courseMark`-kind points instead of a raw
`courseMarks` array. It stays the **course sheet** — running order and roundings
at a glance — and excludes Via Points and plan endpoints. Via Points do not
change the running order, and interleaving them makes the numbered sequence
harder to scan for the one thing the dialog exists to show; the read-only Plan
Map from ticket 04 answers route shape.

### Module placement

- `features/course/util/` — the row mapper producing `CourseRoute`.
  `features/course/api/` — `useCourseRoute`. `RoutePoint`, `RouteSegment`,
  `RouteLeg`, `CourseRoute` are `features/course` types. Exactly as ADR-0001
  specified.
- `features/plan/util/` — `buildPlanRoute`, `computeRouteGuidance`.
  `features/plan/hooks/` — `usePlanRoute`. `PlanRoute`, `GuidedRoute`,
  `GuidedSegment` are `features/plan` types.

A plan endpoint is a Plan concept — the Course knows nothing about where this
particular sail began — and guidance depends on `twd`, which lives in the plan
store. So `features/course` owns the durable, wind-agnostic route and
`features/plan` owns endpoints and guidance. `features/plan` imports from
`features/course`, never the reverse, which is the direction the dependency
already runs.

### Noted for implementation, not decided here

A Course with fewer than two Course Marks has no Legs; with a custom start it
has exactly one. Plan results needs an explicit empty state for the no-Leg case.

## Comments

Resolved by a `grilling` session against `getCourses.ts`,
`app/(plan)/course/plan.tsx`, `app/(plan)/course/leg.tsx`, `CourseLegCard.tsx`,
`PlanCourse.tsx`, `CourseListItem.tsx`, `CourseMarkListDialog.tsx`,
`courseLegData.ts`, `legPlanData.ts`, and `useSailSuggestions.ts`. Eleven
decisions in sequence: read-model shape, caller migration, custom start/finish,
segment computation, Leg-level guidance, Leg-detail scope, param transport,
rounding direction, assembly hook, the Course Mark dialog, and module placement.

The Leg-detail *scope* question (one Segment vs the whole Leg with one focused)
was raised here and handed to prototype ticket
[10](10-prototype-leg-detail-multi-segment.md) as a layout question; this ticket
fixed only the param contract, which supports either outcome.

One recommendation was adjusted by the human: `usePlanRoute` takes `twd` as an
explicit argument rather than reading the plan store internally.
