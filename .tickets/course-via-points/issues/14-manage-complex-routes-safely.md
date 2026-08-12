# 14 — Manage complex routed Courses safely

**What to build:** A sailor can deliberately reorder and restructure a Course containing several Via Points without silently changing Leg ownership, losing route constraints, or leaving a partially mutated route.

**Blocked by:** 13 — Add and edit local Via Points spatially.

**Status:** ready-for-agent

- [ ] Several local and Mark-backed Via Points can coexist in one Leg and remain in contiguous deterministic order.
- [ ] Visible controls move a Via Point within its current Leg one position at a time and disable or adapt appropriately at the ends.
- [ ] Moving a Via Point across a Course Mark is a separate explicit action that changes its owning Leg while preserving its identity, representation, and note.
- [ ] Course Mark reordering is blocked whenever the move would affect Legs containing Via Points, and the message names the affected Legs and Via Points that must be resolved.
- [ ] Deleting an interior Course Mark merges its adjacent Legs and concatenates their Via Points in route order without losing notes or identities.
- [ ] Deleting the first or last Course Mark identifies the adjacent Leg and the number or names of Via Points that will also be deleted before confirmation.
- [ ] Deleting a Via Point never deletes a saved Mark that backs it.
- [ ] Every accepted action saves immediately as one transaction, and every rejected action leaves the observable Course route unchanged.
- [ ] Global Undo correctly reverses additions, edits, reorders, cross-Leg moves, representation changes, Via Point deletion, and Course Mark deletion or merge; only the latest action remains undoable.
- [ ] Direct Legs and Legs containing one or several Via Points retain the same Route-thread structure, while Course Mark summaries and Course list badges remain Course-Mark-only.
- [ ] Automated tests cover every insertion gap, in-Leg reorder, explicit cross-Mark movement, blocked Course Mark reorder, interior merge, outer deletion, note preservation, one-step inverses, and transaction failure without partial mutation.

