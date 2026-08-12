# Course Via Points — Execution Plan

Status: ready-for-agent

This document turns the approved specification into an implementation order. It
does not replace the individual tickets: each ticket remains the source of truth
for its own acceptance criteria.

An easily scanned companion is available in
[the execution-plan artifact](execution-plan.html).

## Delivery shape

```text
11 Route foundation
        |
        v
12 Saved-Mark Via Point tracer bullet
        |
        v
13 Local spatial Via Points
        |
        v
14 Complex route editing and Undo
        |
        v
15 Complete Plan presentation and edit round trip
        |
        v
16 Live Segment detail and final integration
```

The sequence is intentionally linear. Each ticket teaches or establishes a
contract used by the next one, and parallel implementation would create more
conflict in the Course route model and shared screens than useful throughput.

Ticket 11 is the sole prefactoring slice. Tickets 12–16 are user-visible tracer
bullets that cross persistence, domain mapping, UI, and tests where those layers
are relevant.

## Working rules for every ticket

1. Read the specification, ADR-0001, domain glossary, and the ticket before
   changing code.
2. Keep the Course feature wind-agnostic. Plan may import Course route types and
   reads; Course must not import Plan.
3. Add or adjust tests at the public pure route or intent-planning seam before
   wiring the corresponding database transaction or UI.
4. Keep every route mutation as one intent-oriented transaction. React
   components must not coordinate multi-row writes.
5. Preserve the Course-Mark-only query for callers that genuinely require the
   official Course Mark sequence.
6. Run focused tests during development. Before finishing a ticket, run lint,
   the full Jest suite, and the repository's TypeScript check. Report those
   separately from device testing.
7. Do not claim runtime behavior from static checks. Complete the manual checks
   assigned to the ticket's gate on an Android emulator or device.

Suggested verification commands from `sailplan-app/`:

```sh
npm run lint
npx tsc --noEmit
npx jest --runInBand
```

If the repository's scripts change, use the current documented equivalents.

## Phase 1 — Make the existing route explicit

### Implement ticket 11

Land the schema, migration, route read model, Segment derivation, transactional
Course Mark intents, and compatibility changes as one green change. Do not begin
Via Point UI while the direct-Course path still bypasses the new seam.

### Review gate A — Persistence and domain foundation

Perform a cross-cutting review before ticket 12. Check:

- the migration preserves valid Course Mark identity and ordering and removes
  only orphaned rows;
- foreign-key activation is safe for every existing deletion path;
- the Via Point CHECK expresses exactly one representation;
- Course route unions prevent nullable database shapes leaking into consumers;
- Legs and Segments have stable identities, indices, and deterministic order;
- route writes are transactional and no ordering write remains in a component;
- Course list counts and custom-location selection still use Course Marks only;
- Course does not depend on Plan.

### Manual smoke test A

Use an installed database with existing Courses where practical:

- launch through the migration and confirm existing Courses and Course Marks;
- open a direct Course and verify its order and directions;
- add a second Course Mark after a first mark at order zero;
- edit, reorder, and delete Course Marks;
- plan a direct Course and compare its bearing/TWA presentation with the
  pre-change behavior;
- verify an incomplete Course has a deliberate state rather than a spinner.

Do not proceed if migration, ordering, or direct Plan compatibility is unclear.

## Phase 2 — Fire the first tracer bullet

### Implement ticket 12

Take one Mark-backed Via Point all the way from insertion in Course Detail to
Segment guidance in Plan results. Include Mark ownership, usage visibility,
deletion safety, notes, and Undo in the same slice so the live-reference model is
complete rather than provisional.

### Review gate B — First end-to-end route slice

Review the full data path together rather than reviewing Course and Plan in
isolation:

```text
saved Mark -> Via Point row -> CourseRoute -> Leg Segments -> Plan guidance
     ^              |              |                |
     +-- usage -----+          Route thread      Plan results
```

Check:

- repeated saved Marks remain legal while Leg-boundary Marks are excluded;
- Mark-backed names and coordinates resolve live and cannot be edited locally;
- changing the reference preserves Via Point identity and Course-owned note;
- Mark deletion is protected by both application messaging and foreign keys;
- the Route thread, Plan results, and intent tests use the same Segment order;
- bearing and TWA are attached to Segments, never multi-Segment Leg headers;
- the Undo inverse restores the user-observable route, not merely row values;
- suggestion data remains loaded once for the Plan screen.

### Manual tracer test B

- add a saved Mark between two Course Marks from a named insertion gap;
- confirm the two Leg-boundary Marks are unavailable and another repeated Mark
  remains selectable;
- edit the Via Point note at 169, 170, 200, and 201 characters and with only
  whitespace;
- replace its backing Mark and verify position, note, and row identity remain;
- rename and move the saved Mark, then verify Course Detail and Plan update;
- attempt to delete the used Mark, inspect every listed role, and navigate from
  the dialog to Course Detail;
- remove the Via Point and verify the saved Mark still exists;
- exercise Undo, dismissal, and replacement by a newer edit;
- confirm Plan shows guidance for both actual Segments and no direct-line value
  on their enclosing Leg.

## Phase 3 — Complete Course route editing

### Implement tickets 13 then 14

Ticket 13 owns the complete spatial lifecycle of a local Via Point, including
the Course Map sheet and promotion. Ticket 14 then generalises the proven point
operations to multi-point ordering and Course restructuring.

Keep provisional map placement state outside the persisted Course route. It may
carry a selected gap or inferred Segment for the lifetime of an add action, but
must not become a second editable route representation.

### Review gate C — Course editing as one system

Review tickets 12–14 together after ticket 14. Check:

- Route-thread gaps and map inference address the same insertion intent;
- confirmation and cancellation have unambiguous transaction boundaries;
- map selection and pending-pin state cannot survive into an unrelated action;
- local and Mark-backed variants remain structurally distinct at every API;
- local pins are draggable and Mark-backed pins cannot accidentally move;
- promotion is atomic and reuses Mark validation;
- every reorder keeps Via Point order contiguous within one owning Leg;
- cross-Leg movement is explicit and Course Mark reorder guards name impacts;
- interior merge and outer deletion preserve or remove Via Points exactly as
  specified;
- all route actions publish correct one-step inverses to the single Undo owner;
- failure or dismissal cannot leave a partially changed route.

### Manual Course-editing pass C

Exercise at least these Course shapes on Android:

- zero, one, and several Via Points in a Leg;
- a mix of local and Mark-backed Via Points;
- the same saved Mark used more than once;
- multiple nearby or crossing Legs;
- a Course with fewer than two Course Marks.

For those shapes verify:

- add from every Route-thread gap;
- add from free Course Map placement and inspect the inferred endpoint names;
- confirm and cancel new placement and relocation;
- open and dismiss the map by close control, backdrop, and Android back;
- return to the originating Route thread or open map sheet after placement;
- rename, annotate, drag, delete, and promote a local Via Point;
- verify Mark-backed pins do not drag;
- reorder within a Leg and explicitly move across a Course Mark;
- trigger a blocked Course Mark reorder and inspect the named dependencies;
- delete an interior Course Mark and inspect the merged order;
- delete an outer Course Mark and inspect the destructive warning;
- use Undo after each action family, then verify dismissal and latest-only
  replacement behavior;
- background or leave the screen after an edit and confirm it was saved.

Do not begin final Plan presentation work until Course editing has one canonical
saved route and passes this matrix.

## Phase 4 — Complete planning and detail

### Implement ticket 15

Finish the Plan route pipeline and all Plan results/map presentation, including
custom Plan endpoints and the edit/recalculation round trip. Treat the saved
Course route as read-only on all Plan surfaces.

### Review gate D — Plan computation and presentation

Before starting Segment detail, check:

- custom endpoints are explicit domain variants and no negative-id fake Course
  Marks remain;
- synthetic Legs have null identity, one Segment, and no saved Via Points;
- all guidance and sail suggestions use the actual Segment endpoints;
- direct Leg presentation is familiar while multi-Segment headers contain no
  misleading guidance;
- endpoint notes appear once at the correct approach point;
- Course Mark directions never leak onto Via Points or Plan endpoints;
- the Plan Map cannot mutate the route;
- returning from Course Detail recomputes from live route data and communicates
  the update;
- loading, error, and empty states are distinguishable.

### Implement ticket 16

Replace serialized computed Leg detail with identity-based Segment resolution,
add sibling navigation and stale-reference recovery, then close issues found by
the final integrated pass.

### Review gate E — Navigation contract and integration

Review Plan results, Plan Map, Course Detail, and Segment detail together:

- route parameters carry identity only, with Zod validation;
- Segment detail and results resolve through the same live Plan-route hook;
- current TWD/TWS and current saved Mark coordinates are used after edits;
- saved and synthetic Leg references cannot collide;
- stale references return to recalculated results without a navigation loop;
- previous/next controls stay within the enclosing Leg;
- full notes and rounding directions appear only where the domain permits;
- no legacy serialized Course guidance snapshot remains in use.

### Manual Plan and detail pass E

Run the Plan matrix with a direct Course and a multi-Segment Course:

- no custom endpoint, start only, finish only, and both endpoints;
- local and Mark-backed Via Point endpoints;
- notes on the first Course Mark, Via Points, and destination Course Marks;
- current bearing, TWA, tack, and sail guidance for every Segment;
- direct-Leg compact presentation and multi-Segment grouping;
- complete read-only Plan Map with no editing gestures;
- Edit saved course, make a route change, return, and observe recalculation;
- open every Segment's detail, inspect the Leg banner and full endpoint notes,
  and navigate among sibling Segments;
- edit or delete the selected Leg while detail is reachable, then confirm stale
  recovery returns to current Plan results;
- verify incomplete Course loading, error, and empty states.

## Completion criteria

The effort is complete only when:

- all six tickets satisfy their acceptance criteria;
- every review gate has been performed against the combined changes, not only
  per-file diffs;
- lint, TypeScript, and the full Jest suite pass;
- the Android manual matrices record actual device/emulator results;
- no unresolved migration, data-integrity, navigation, or stale-route issue is
  deferred without a separately approved ticket;
- the delivered terminology consistently uses Course Mark, Via Point, Leg, and
  Leg Segment.

