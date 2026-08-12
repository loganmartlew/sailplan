# 13 — Add and edit local Via Points spatially

**What to build:** A sailor can shape a Course with a course-local Via Point from either a precise Route-thread gap or free placement on the Course Map, then edit, move, annotate, remove, or promote that point while seeing its effect throughout the saved route and Plan.

**Blocked by:** 12 — Reuse a saved Mark as a Via Point end to end.

**Status:** ready-for-agent

- [ ] Course Detail opens its Course Map as a partial-height sheet over the Route thread from a collapsed inline preview.
- [ ] The sheet dismisses through its close control, backdrop, and Android back action without creating a separate edit draft or navigation-owned Course copy.
- [ ] Starting Map pin from a Route-thread gap opens placement for that exact Segment and returns the sailor to the surface where the action began.
- [ ] Free placement begun in the Course Map selects the nearest Leg Segment and names both inferred endpoints before confirmation, including when nearby or crossing geometry makes the choice important.
- [ ] A pending local pin is visually distinct from saved route points, receives a stable Course-unique default name selected for easy replacement, and is not persisted until explicit confirmation.
- [ ] Cancelling placement or relocation leaves the saved Course unchanged; confirming it performs one immediate durable route transaction.
- [ ] A local Via Point can be renamed, relocated from its row or draggable map pin, annotated, and removed; Mark-backed pins remain non-draggable.
- [ ] The map draws the complete route polyline and distinguishes Course Marks, local Via Points, Mark-backed Via Points, and the pending pin; selecting a saved point shows its note.
- [ ] A local Via Point can be promoted through Add to saved marks using ordinary Mark validation and an editable proposed name with read-only coordinates.
- [ ] Promotion inserts the Mark and changes the Via Point representation atomically while preserving Via Point identity, Leg, order, and note.
- [ ] Course Detail and Plan results distinguish local from Mark-backed Via Points while applying the same Segment derivation and guidance rules to both.
- [ ] Every new route edit in this slice participates in the global latest-action Undo behavior.
- [ ] Automated tests cover named-gap insertion, nearest-Segment inference, stable naming, confirmation/cancellation, local mapping, relocation, promotion atomicity, point-kind presentation data, and Undo outcomes.

