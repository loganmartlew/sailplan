# Choose the Course route-point persistence model

Type: grilling
Status: resolved
Blocked by: 01

## Question

What persistence model should represent ordered Course Marks and Via Points while enforcing their different roles, supporting either local coordinates or a live Mark reference, preserving multiple occurrences of the same Mark, and making Leg/Leg Segment queries and transactional route edits coherent?

Use the `codebase-design` vocabulary, inspect the existing Drizzle schema and Course APIs, and record the rejected alternatives and migration consequences. This decision should determine whether an ADR is warranted.

## Answer

Recorded in full, with the rejected alternatives, as
[ADR-0001 — Course route-point persistence](../../../docs/adr/0001-course-route-point-persistence.md).
An ADR **was** warranted; it is the repo's first, created lazily per
`docs/agents/domain.md`.

- **Leg-scoped Via Point table.** New `courseViaPoint(id, legStartCourseMarkId →
  courseMark.id, order, markId?, name?, latitude?, longitude?, note?)`;
  `courseMark` is unchanged. A Leg *is* its start `courseMark` row, so "a Via
  Point lives inside exactly one Leg" is a schema fact, in-Leg reorder is
  Leg-local, and the explicit cross-Mark move is an FK change. The nested read
  Course Detail and Plan results both want is one Drizzle relational query.
  Rejected: a unified `coursePoint` table with a `role` column and a global
  order (permits Via Points outside any Leg, renumbers the Course tail on every
  insert, leaves `direction` meaningless for half the rows, costs a destructive
  migration); and Course-scoped Via Points ordered against the global sequence
  (Leg membership derived, so Course Mark reorder silently re-parents points).
- **Local or Mark-backed in one row, guarded by CHECK**: either `markId` alone,
  or `name` + `latitude` + `longitude` together. A Mark-backed Via Point stores
  no identity of its own — no per-Course name override. Promotion keeps the row
  id, Leg, and position. Callers never see nullables; the module maps to
  `{ kind: 'local' } | { kind: 'markBacked' }`. Rejected: a table per kind
  (order would interleave across two tables) and materialising hidden `mark`
  rows for local points (leaks into every Mark list, picker, and share path).
- **`note` is an optional text column meaningful to both kinds.** Its product
  half — where a note surfaces, whether Course Marks get one — is deferred to
  [08 — Decide Via Point and Course Mark notes](08-decide-route-point-notes.md).
  Nothing needs reserving now: adding a nullable column is the one migration
  SQLite does cheaply.
- **Contiguous integer `order` per Leg**, no unique index (SQLite checks
  uniqueness per statement, which would collide mid-renumber), reads sort
  `order, id` so ties degrade to insertion order. The route module is the only
  writer of `order`. Rejected: sparse integers and fractional ordering (a
  rebalance path that never runs is a path that is always broken; Segments are
  selected by stable name, not computed rank) and a linked list (unreadable by
  the relational query).
- **Writes are immediate and durable — one `db.transaction` per intent.** No
  draft state of any kind. This is the only reading consistent with ticket 01's
  amendment and prototype 03, and it retires stale-draft and concurrent-edit
  handling from the map's fog. Tickets 02 and 07 have been amended: their
  "shared draft with a Save/Cancel boundary" is now a **shared selection
  context** with immediate durable actions.
- **Deleting an interior Course Mark merges** its two adjacent Legs and
  concatenates their Via Points in order — removing a rounding does not move the
  headland the Via Point shapes. Deleting the first or last Course Mark destroys
  a Leg with nowhere to merge, so its Via Points are deleted behind a
  confirmation naming the count. Reorder stays blocked per ticket 01, because
  reorder scrambles geometry and has no correct automatic answer; deletion does.
- **Mark deletion is blocked in two layers**: an application guard counting
  usages across `courseMark` and `courseViaPoint` that names the blocking
  Courses (the message), and `PRAGMA foreign_keys = ON` in `lib/db.ts` (the
  guarantee). Today neither exists — the pragma is off, so every `references()`
  is documentation, and `deleteMark` deletes unconditionally.
- **One intent-based route module** at `features/course/api/`
  (`useCourseRoute`, `addViaPoint`, `updateViaPoint`, `removeViaPoint`,
  `reorderViaPointsInLeg`, `moveViaPointToLeg`, `deleteCourseMark`,
  `reorderCourseMarks`, `markRouteUsage`), with row mapping and intent planning
  as pure functions in `features/course/util/` — the internal seam that makes
  merge-on-delete, renumbering, and blocked-reorder Jest-testable without
  SQLite. Rejected: keeping per-row writers composed by components, which is
  how both live bugs below were produced.
- **`courseId` is not denormalised onto `courseViaPoint`.** Considered and
  dropped: usage lookup is one join through `legStartCourseMarkId`, the
  delete-course sweep is one subquery, and the hot read never touches it — while
  a second source of truth for a point's Course cannot be enforced by any CHECK
  and would be believed by exactly the two consumers that must not be lied to.
- **One migration**: create `courseViaPoint` with its CHECK, and delete
  `courseMark` rows orphaned by the shipped `deleteMark` bug. Plus the pragma
  change in `lib/db.ts`.

### Shipped bugs found while inspecting, fixed as part of this work

- `createCourseMark` (`features/course/api/createCourse.ts`) uses
  `maxOrders[0]?.maxOrder ? maxOrder + 1 : 0`, so the **second** Course Mark of
  a Course is also given `order: 0` — a falsy-zero tie that `useCourseMarks`
  then sorts arbitrarily until a drag-reorder accidentally repairs it.
- `deleteMark` (`features/mark/api/deleteMark.ts`, called from
  `app/marks/index.tsx:39` after a plain confirmation) deletes a Mark that
  Courses reference; with foreign keys off, the `courseMark` rows survive and
  `with: { mark: true }` hands components a `null` Mark.

## Comments

Resolved by a `grilling` session against `schema.ts`, the Course/Mark APIs, and
`lib/db.ts`. Seven decisions were put in sequence: table shape, local-vs-Mark
representation, ordering, draft-vs-immediate writes, Course Mark deletion,
Mark-deletion enforcement, and the module seam. The `courseId` denormalisation
proposed with shape A was challenged and dropped.

