# Decide Via Point and Course Mark notes

Type: grilling
Status: resolved
Blocked by: 05

## Question

Should route points carry a free-text note recording the sailor's intent
("stay outside the reef", "only if the tide is running"), and if so: do Course
Marks carry one as well as Via Points, where does it surface in the Route
thread, and does it reach Course Plan results?

The persistence half is already settled — [05](05-choose-persistence-model.md)
records `note` as an optional text column on `courseViaPoint`, meaningful to
both course-local and Mark-backed points, and a nullable column is the one
migration SQLite adds cheaply, so nothing is reserved by deferring. A note is
Course-scoped *intent*, which is why it sits on the route point rather than on
the saved Mark: the same Mark used in two Courses may warrant different notes.

What is undecided is product:

- **Symmetry.** `courseMark` has no note either, and in the Route thread both
  render as rows in the same list. Notes on Via Points alone would read as an
  arbitrary gap the first time a sailor tries to annotate a rounding.
- **Route thread placement.** Prototype [03](03-prototype-course-detail-structure.md)
  chose the Route thread without a note in it.
- **Plan results.** Prototype [04](04-prototype-plan-presentation.md)
  deliberately made Leg Segment rows *lighter* than cards — bearing, TWA, tack,
  sail. A note would be the first non-computed thing wanting a place there, and
  it is arguably the most valuable thing to see mid-race.
- **Row crowding.** Adding a note is what tips a Via Point row past the point
  where rename, relocate, remove, reorder, and **Add to saved marks** can all be
  visible controls. Whether the row's action set moves behind a 3-dot overflow
  menu is part of this same conversation, not a separate one.

Finish the session by asking whether a prototype is wanted before this
resolves — the honest question is how a note and its actions fit on a crowded
mobile row, and both surfaces it touches already have prototypes to extend.

## Answer

Settled in a `grilling` session against `schema.ts`, `CourseMarkListItem.tsx`,
`CourseMarks.tsx`, `CourseLegCard.tsx`, and `app/(plan)/course/leg.tsx`. Ten
decisions in sequence, then confirmed against a prototype built to attack the
row-crowding risk — see Comments. The prototype's two alternative row layouts
were **rejected**; the decided design below survived unchanged.

### The note itself

- **Both route point kinds carry a note**: ADR-0001's `courseViaPoint.note`,
  plus a new nullable `courseMark.note`. The decisive fact is that
  `courseMark.direction` already exists — a nullable, Course-scoped hint that
  lives on the course-point row rather than on the saved `mark`, and that
  already rides into Plan results (`CourseLegCard.tsx:91`) and the Course row
  (`CourseMarkListItem.tsx:38`). A note is the same shape of thing, so it goes
  in the same place, and a nullable text column is the migration SQLite adds
  cheaply. Notes on Via Points alone would read as an arbitrary gap, since both
  kinds render as rows in one list.
- **Capped at 200 characters**, enforced in the editor by rejecting further
  input, with a counter appearing only in the last 30. No error state. The cap
  exists so the "never truncated on Leg detail" promise below has a bounded
  worst case; ~200 characters is three to four lines on a 390pt phone, long
  enough for the conditional notes ("only if the tide is running — otherwise
  cut inside the green") that are the most useful kind. A cap chosen now is
  free; a cap chosen after release is a data migration.
- Whitespace-only input stores as `NULL`, not `''`.
- Promotion and **Change Mark** preserve the note — already guaranteed by
  [06](06-decide-saved-mark-transition-behavior.md) and ADR-0001, which keep
  row id, Leg, `order`, and `note` across both.

### Route thread

- The note renders as **muted secondary text directly under the point name,
  clamped to one line** with ellipsis. Rows without a note show nothing extra —
  no empty slot, no placeholder. The note's value is being readable while
  scanning the route; hiding it behind a tap makes it a thing you must already
  know is there.
- **Tapping a row opens that point's editor**; a `⋯` overflow menu holds the
  rest, including remove. This collapses rename and edit-note into the row's
  primary gesture, leaving a short stable menu: relocate, **Add to saved
  marks**, remove for a local Via Point; **Change Mark** and remove for a
  Mark-backed one. Explicit in-Leg reorder controls stay visible on the row —
  reorder is done in repeated bursts, and [03](03-prototype-course-detail-structure.md)
  chose explicit controls over drag.
- **The same treatment applies to Course Mark rows** — tap to open the existing
  `NewCourseMarkDialog` (`CourseMarks.tsx:75`), now carrying mark, direction,
  and note; `⋯` holds remove. Today the pencil opens that dialog and tapping
  the row does nothing. Full symmetry by the same argument that put notes on
  both kinds: two rows in one list, and a rule firing on one but not the other
  reads as a defect. It also puts the *more* destructive delete behind a
  deliberate step — removing a Course Mark restructures the Course and merges
  Legs, removing a Via Point does not.

### Course Map

- The **selected** pin shows its note clamped to one line, in the selection
  affordance [03](03-prototype-course-detail-structure.md) already requires.
  This is the surface where "why is there a dogleg here?" is loudest, and it
  costs no new UI. It does not weaken 03's "route shape only" rule, which is
  about navigability claims.
- The read-only Plan Map shows nothing — it is scenery beside a list that
  already carries the same text.

### Plan results

- The note renders on the **Leg Segment row that ends at that point**, as a
  muted line under `from → to`, **clamped to one line**. A note is guidance for
  how you approach and pass a point, so the Segment sailing *into* it is when
  you want it. The rule is unambiguous without new row types: every route point
  is the `to` of exactly one Segment, so no note is orphaned or shown twice.
- **Exception**: the course's very first point, when the Plan has no custom
  start, is the destination of no Segment. Its note goes on the Leg 1 group
  header.
- This preserves [04](04-prototype-plan-presentation.md)'s deliberately light
  Segment timeline rows.

### Leg detail

- **The Leg detail screen shows, in full and unclamped, the notes of every
  route point it covers, in route order**, beside the endpoint labels that
  already carry the P/S `direction` badge.
- Stated unit-agnostically **on purpose**. Whether that screen is the detail of
  a Leg Segment or of a whole Mark-to-Mark Leg is not settled and is not this
  ticket's to settle — it belongs to
  [09](09-specify-route-query-and-plan-calculation.md), which was already
  claimed and in progress. The rule holds either way: a per-Segment screen
  shows its two endpoints' notes, a per-Leg screen shows every point in the
  Leg.
- The rule also closes the orphan case above for free, since the course's first
  point is covered by the screen containing it even though nothing sails into
  it.
- Rejected: expanding a clamped note in place on Plan results. The full note
  belongs on the screen the sailor already goes to for depth, not behind a
  tap-to-expand on a phone in spray.

### The saved Mark gets no note

`mark` gains no note column. A note about the Mark *itself* — "hard to see
against the trees", "the pole is 200m north of the charted position" — is a
real want but a different feature with a different lifetime, needing its own
surfaces (Mark editor, Mark list) and a merge rule for rendering alongside the
Course-scoped note. Ruled **out of scope**; see the map.

## Comments

- **Prototype asset**: [route point notes mockup](../prototypes/route-point-notes/index.html?variant=thread-note)
  — run `python3 -m http.server 8000` from `prototypes/route-point-notes/`; see
  its [README](../prototypes/route-point-notes/README.md). A 390px phone frame,
  covering Legs with zero, one, and three Via Points, local and Mark-backed
  points side by side, points with and without notes, a 197-character note at
  the cap, and a Course Mark carrying both a `P` badge and a note.
- **Human verdict: `thread-note` and `plan-note` accepted.** The decided row —
  name and badge, clamped note beneath, explicit reorder arrows, `⋯` — holds as
  specified, as does the Plan-results treatment including the Leg 1 header
  fallback for the course's first point.
- **Rejected: `thread-compact`** (name and note sharing one line, reorder arrows
  collapsed). It bought ~40% shorter rows but left roughly a quarter of a
  197-character note visible, which is not enough for the line to say anything.
- **Rejected: `thread-stacked`** (note on its own full-width line below the
  controls). Its later clamp — ~55 characters against `thread-note`'s ~40 — did
  not justify the extra row height, and it pushed the note away from the name it
  describes.
- The prototype was built to test row crowding specifically: a Via Point row
  carries a name, a clamped note line, reorder controls, and a `⋯` menu on a
  390pt phone, while local and Mark-backed points must stay visually distinct
  per [06](06-decide-saved-mark-transition-behavior.md). Both survived.
- **Accepted consequence**, surfaced by the prototype and not decided in the
  interview: Course Mark rows have no reorder arrows, so their note line runs
  longer before clamping than a Via Point's at the same depth. Visible when
  scanning a Course Mark against a Via Point. Accepted — the alternative is
  padding Course Mark rows with dead space to match a control they do not have,
  which trades a mild inconsistency for a meaningless one.
- **Raised from this session**:
  [Prototype the Leg detail screen under multi-Segment Legs](10-prototype-leg-detail-multi-segment.md).
  The Leg detail rule above is deliberately unit-agnostic because that screen's
  unit is undecided; ticket 10 settles the presentational half.
  [09](09-specify-route-query-and-plan-calculation.md) resolved concurrently and
  confirmed the split: its Leg detail contract carries **both** `legRef` and
  `segmentIndex` precisely so ticket 10 can choose one-Segment-vs-whole-Leg
  without reopening it. 09's body was left untouched by this session — it was
  claimed and in progress at the time.
- The leg-details prototype in the wind-shifts effort
  (`sailplan.wind-shifts/.tickets/wind-direction-uncertainty/prototypes/03-planning-experience.html`)
  was checked and does **not** settle the unit question: it says "Leg details"
  eight times and "Segment" zero times, having been built before Via Points
  split a Leg.
