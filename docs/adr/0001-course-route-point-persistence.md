# ADR-0001 — Course route-point persistence

Status: Accepted
Date: 2026-08-11
Context: Course Via Points ([wayfinding map](../../.tickets/course-via-points/map.md),
ticket [05 — Choose the Course route-point persistence model](../../.tickets/course-via-points/issues/05-choose-persistence-model.md))

## Context

A Course is an ordered list of **Course Marks** (reusable Marks acting as Leg
boundaries). Via Points add a second kind of route point: a directionless role
*inside* a Leg that shapes the intended route around land, splitting the Leg
into straight **Leg Segments**. A Via Point is either **course-local** (its own
name and coordinates) or **Mark-backed** (a live reference to a saved Mark,
read-only in the Via Point interface).

Before this decision the schema had `course → courseMark(courseId, markId, order,
direction) → mark`, with no local-coordinate concept anywhere, and route writes
were composed at call sites (`CourseMarks.tsx` reordered with a `Promise.all` of
row updates; `createCourseMark` computed its own `max(order) + 1`).

## Decision

### Leg-scoped Via Point table

```
courseViaPoint
  id                    integer pk
  legStartCourseMarkId  integer not null -> courseMark.id
  order                 integer not null            -- contiguous 0..n within the Leg
  markId                integer          -> mark.id -- Mark-backed
  name                  text                        -- course-local
  latitude              real                        -- course-local
  longitude             real                        -- course-local
  note                  text                        -- optional, both kinds (see ticket 08)

  check: (markId is not null and name is null and latitude is null and longitude is null)
      or (markId is null and name is not null and latitude is not null and longitude is not null)
```

`courseMark` is unchanged. A **Leg** is identified by its start `courseMark`
row; **Leg Segments** are the spans between consecutive route points. A Via
Point's Course is reached through its Leg — `courseId` is deliberately *not*
denormalised onto this table.

### Supporting rules

1. **Ordering** is contiguous integers per Leg with **no unique index**;
   reads sort `order, id` so any tie degrades to insertion order. The route
   module is the only writer of `order`.
2. **Writes are immediate and durable**, one `db.transaction` per user intent.
   There is no draft state, no Edit-route mode, and no Save/Cancel boundary.
3. **Deleting an interior Course Mark merges** its two adjacent Legs and
   concatenates their Via Points in order. Deleting the first or last Course
   Mark destroys a Leg with nowhere to merge, so its Via Points are deleted
   behind a confirmation naming the count. Course Mark *reorder* stays blocked
   while affected Legs hold Via Points.
4. **Mark deletion is blocked in two layers**: an application guard that counts
   usages across `courseMark` and `courseViaPoint` and names the blocking
   Courses, and `PRAGMA foreign_keys = ON` on the connection as the integrity
   net under every writer.
5. **One route module** at `features/course/api/` exposes intents
   (`addViaPoint`, `reorderViaPointsInLeg`, `moveViaPointToLeg`,
   `deleteCourseMark`, `markRouteUsage`, …) and a nested read
   (`useCourseRoute`). Row mapping and intent planning are pure functions in
   `features/course/util/` — the internal seam that makes merge-on-delete,
   renumbering, and blocked-reorder testable without SQLite. Nullable columns
   never escape the module; callers see `{ kind: 'local' } | { kind: 'markBacked' }`.

## Alternatives rejected

- **Unified `coursePoint` table with a `role` column** and one order across the
  Course. Makes "a Via Point lives inside a Leg" a code rule rather than a
  schema fact (a via can sort outside any Leg), turns every Leg-scoped question
  into position arithmetic, renumbers the Course tail on every insert, leaves
  `direction` meaningless for half the rows, and costs a destructive migration
  of a shipped table for no capability shape A lacks.
- **Course-scoped Via Points ordered against the global sequence.** Leg
  membership becomes derived, so reordering Course Marks silently re-parents
  Via Points — the exact outcome the blocked-reorder rule exists to prevent.
- **Separate tables per kind** (local / Mark-backed). Order within a Leg would
  have to interleave across two tables, breaking the single ordering invariant
  and the single nested read; promotion would lose row identity.
- **Materialising a hidden `mark` row for every local point** with a
  saved/hidden flag. Uniform and makes promotion a flag flip, but changes a
  shipped global table — every Mark list, picker, and share path must filter it,
  and one omission leaks a private course-local pin into the sailor's saved
  Marks. Also makes "Mark-backed points are read-only" a flag test rather than a
  structural fact.
- **Sparse / fractional ordering, or a linked list.** Unneeded at one-to-five
  Via Points per Leg; fractional ordering makes Segment position a computed rank
  when the UI selects Segments by stable name, and a linked list can't be read
  by Drizzle's relational query, breaking the single nested `useLiveQuery`.
- **A persisted or UI-held edit draft.** A UI-held draft dies with the screen
  (backgrounding discards work) and forces every route-rendering component to
  choose between draft and saved state; a persisted draft adds a second
  representation of the route plus reconciliation and staleness handling.

## Consequences

- **One migration**: create `courseViaPoint` with its CHECK, and delete
  `courseMark` rows whose `markId` has no matching Mark — orphans already
  created by the unguarded `deleteMark` on installed copies. `courseMark`'s
  definition is untouched, so existing rows and every current `useCourseMarks`
  caller keep working.
- **`PRAGMA foreign_keys = ON`** is set on the connection in `lib/db.ts`. Every
  `references()` in `schema.ts` becomes enforcement rather than documentation;
  delete ordering (Via Points → Course Marks → Course) is now checked.
- **Two shipped bugs are fixed as part of this work**: `createCourseMark`'s
  `maxOrder ? maxOrder + 1 : 0` gives the second Course Mark of a Course
  `order: 0` again (falsy zero), and `deleteMark` deletes a Mark that Courses
  reference, leaving `courseMark` rows whose `with: { mark: true }` resolves to
  `null`.
- Route writes move out of components and behind the route module; the existing
  `Promise.all` reorder in `CourseMarks.tsx` is replaced by
  `reorderCourseMarks`.
- Stale-draft and concurrent-edit handling stop being open questions: with no
  draft, the saved Course is the only state, and each transaction begins and
  ends on a legal route.
