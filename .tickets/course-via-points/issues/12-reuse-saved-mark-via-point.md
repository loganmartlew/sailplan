# 12 — Reuse a saved Mark as a Via Point end to end

**What to build:** A sailor can reuse a saved Mark as a directionless Via Point inside a named Leg Segment, manage that live reference from Course Detail, understand its effect in the Mark editor, and receive Plan guidance for the actual Segments it creates.

**Blocked by:** 11 — Establish the canonical Course route foundation.

**Status:** ready-for-agent

- [ ] Course Detail presents the saved Course as a Route thread with Course Marks as anchors, Mark-to-Mark Legs beneath them, and insertion gaps between consecutive route points.
- [ ] Choosing Existing Mark for a gap inserts one Mark-backed Via Point immediately and durably into the selected Leg and order.
- [ ] The chooser excludes only the two Course Marks bounding the target Leg; all other Marks remain selectable, including a Mark already used elsewhere in the Course.
- [ ] Mark-backed Via Points are visibly distinct, directionless, and expose their saved Mark-owned name and coordinates as read-only values.
- [ ] A Mark-backed Via Point row supports editing its Course-scoped note, replacing its backing Mark without changing its identity, Leg, order, or note, and removing it without deleting the saved Mark.
- [ ] Route-point notes reject more than 200 characters, show a remaining-character counter only for the final 30 characters, normalise whitespace-only values to absent, and display clamped to one line in the Route thread.
- [ ] The Mark editor shows every Course using the Mark and identifies whether each use is a Course Mark or a Via Point in a named Leg.
- [ ] Renaming or moving a used Mark updates every Course use without an additional impact confirmation.
- [ ] Deleting a used Mark is blocked; the dialog lists every affected Course and role and lets the sailor navigate to each Course Detail screen.
- [ ] Plan results for a Leg containing one Mark-backed Via Point calculate bearing, TWA, tack, and sail guidance independently for its two actual Segments, using the saved Mark's current coordinates and omitting misleading direct-line guidance from the enclosing Leg.
- [ ] The first one-level global Undo implementation reverses the latest supported route edit, and a newer action or dismissal retires the previous inverse.
- [ ] Automated tests cover repeated saved Marks, boundary exclusions, live reference resolution, usage reporting, blocked deletion, notes, atomic route intents, Undo, and endpoint-specific Segment guidance.

