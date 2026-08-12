# 11 — Establish the canonical Course route foundation

**What to build:** Existing Course Mark-only Courses continue working through a canonical Course route read model and transactional route module, creating a safe foundation for Via Points without changing how sailors recognise or plan a direct Course.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Existing installations migrate without losing valid Course Marks or changing their identities and ordering.
- [ ] The migration adds Leg-scoped Via Point persistence and Course-scoped Course Mark notes, enforces exactly one local-or-Mark-backed Via Point representation, and removes pre-existing orphaned Course Mark rows before foreign keys are enabled.
- [ ] SQLite foreign-key enforcement protects all existing and new route relationships after startup.
- [ ] Course route reads expose discriminated Course Mark, local Via Point, and Mark-backed Via Point values with resolved names and coordinates; nullable storage shapes do not escape the Course feature.
- [ ] A Course route contains ordered Course Marks, Mark-to-Mark Legs, ordered Via Points, derived Leg Segments, and one consistently ordered flattened point collection.
- [ ] Direct Courses derive exactly one Segment per Leg and continue producing the same observable Course Detail and Plan guidance as before this change.
- [ ] Course Mark creation, editing, ordering, and deletion are routed through intent-oriented transactional operations rather than multi-write composition in React components.
- [ ] Adding a Course Mark after an existing order of zero assigns the next contiguous order rather than duplicating zero.
- [ ] The Course-Mark-only read remains available for the Course list count, Course Mark summary, and custom start/finish location picker.
- [ ] Automated tests cover direct-route mapping, deterministic ordering, Segment identity, malformed Via Point rejection, migration-sensitive invariants, and the Course Mark insertion regression.

