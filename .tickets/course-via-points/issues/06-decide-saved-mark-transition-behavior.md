# Decide saved-Mark linking and promotion behavior

Type: grilling
Status: resolved
Blocked by: 05

## Question

What exact rules and user feedback govern choosing an existing Mark as a Via Point, using **Add to saved marks** on a local Via Point, name conflicts, failed promotion, replacing or detaching a reference, and deletion blocked by Course usage?

The answer must preserve the rule that Mark-backed Via Points are read-only in the Via Point editor and that promotion does not turn a Via Point into a Course Mark.

## Answer

### Choosing an existing Mark

- The Existing-Mark chooser lists every saved Mark **except the two Course
  Marks bounding the Leg being split** — using a Leg's own boundary as a Via
  Point inside that Leg is geometrically meaningless. Every other Mark stays
  selectable, including Marks already used elsewhere in this Course, already
  used as a Course Mark, or already a Via Point in this same Leg: ADR-0001
  deliberately preserves multiple occurrences of the same Mark, and an
  out-and-back course legitimately passes the same headland twice.
- Presentation is a **flat name list**, matching today's
  `NewCourseMarkDialog` (`features/course/components/`). Excluded Marks are
  absent rather than disabled — there is no story where picking them is right,
  so an explanation would be noise. No usage annotations and no coordinates.
  Consequence accepted: two Marks with the same name are indistinguishable in
  the chooser.
- **Change Mark** on an existing Mark-backed Via Point reuses this same chooser
  with the same exclusion rule.

### Promotion — **Add to saved marks**

- Offered **only on course-local Via Points**. A Mark-backed Via Point does not
  show the action.
- Tapping it opens a **confirm sheet**: the Via Point's name prefilled and
  **editable**, its coordinates shown **read-only**, and a Save action. The
  local name is often an auto-generated one that is fine inside a Course and
  useless in the global Mark list, and this is the sailor's only chance to fix
  it — after promotion the name is read-only and owned by the Mark. Coordinates
  stay read-only because promotion is role- and position-preserving; editing
  them here would silently move the route.
- **Validation is whatever Mark creation enforces.** Today
  `features/mark/components/MarkForm.tsx` (used by `app/marks/new.tsx`)
  requires a non-empty name and numeric coordinates and checks nothing else —
  in particular `mark.name` has **no** unique constraint in `schema.ts` and no
  uniqueness validation anywhere. So a name that collides with an existing Mark
  **saves silently**. This is a shared rule, not a promotion-specific one: if
  Mark creation ever adopts uniqueness, promotion inherits it for free. A
  uniqueness rule enforced only at promotion would be an inconsistent rule the
  sailor learns by being stopped.
- **Promotion is one `db.transaction`** covering the Mark insert and the row's
  conversion to Mark-backed (per ADR-0001: same row id, Leg, `order`, `note`).
  On failure **nothing changed** — the sheet stays open with an error, the Via
  Point is still local, and no orphan Mark exists. A partial outcome is worse
  than none here: an orphan Mark is invisible from the Course and only found
  later in the Mark list.
- No copy anywhere calls the result a Course Mark. Promotion creates a **saved
  Mark**; the point keeps its Via Point role and its position in the Leg.

### Living with a reference

- A Mark-backed Via Point gets **Change Mark** and **no detach**. The
  local → Mark-backed conversion is **one-way**: to reposition a linked point,
  delete it and add a local one. Change Mark swaps `markId` in place as an
  immediate durable write, keeping row id, Leg, `order`, and `note`.
- **Mark-backed pins are not draggable on the Course Map, and fail silently.**
  Local and Mark-backed Via Points are **visually distinct** — on the map pins
  and in the Route thread rows and Plan results — so the rule reads off the
  point itself rather than being taught by a failed gesture.
- The **Mark editor** shows a passive, tappable **"Used by N courses"** line
  whenever usage is non-zero (the same list as the blocked-delete dialog).
  Saving — rename or move — **asks nothing**. Following the Mark is the whole
  point of linking, so a confirmation on every edit would nag about the
  intended behaviour; the usage data is already computed for the delete guard,
  so the line is nearly free.

### Deletion blocked by Course usage

- The guard counts usages across **`courseMark` and `courseViaPoint`**, so a
  Mark used *only* as a Via Point still blocks deletion.
- The blocked dialog **names each Course and the role it uses the Mark in** —
  "Harbour Race — Course Mark", "Bay Loop — Via Point in Leg 2" — and **each
  line navigates to that Course**. The role matters because the remedy differs:
  removing a Course Mark restructures the Course and merges Legs, removing a
  Via Point does not. Without navigation the sailor is told to go somewhere but
  not taken there. Delete is unavailable; there is no "remove everywhere"
  escape hatch, which would silently restructure Courses the sailor is not
  looking at.
- Deleting a **Mark-backed Via Point** removes only that row. The Mark is
  untouched, with no extra confirmation.

## Comments

Resolved by a `grilling` session against `schema.ts`, `MarkForm.tsx`,
`app/marks/new.tsx`, and `NewCourseMarkDialog.tsx`. Seven decisions in
sequence: chooser scope, chooser presentation, promotion flow, name-conflict
validation, promotion failure semantics, replace-vs-detach, map-drag behaviour,
blocked-delete messaging, and used-Mark editing.

Two recommendations were rejected by the human and the ticket follows the
human's choice: chooser usage annotations (rejected in favour of parity with
the existing flat chooser) and **Detach from saved Mark** (rejected — linking
is one-way).
