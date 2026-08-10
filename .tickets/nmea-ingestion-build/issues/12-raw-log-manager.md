# 12 — The raw log manager

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §11. User stories 85–89, 93.

**What to build:** The sailor can see what the raw logs are costing them and
decide what to reclaim from evidence rather than anxiety. Nothing is ever deleted
automatically — no age limit, no cap, no oldest-first eviction — so data never
disappears behind their back. Deleting a log leaves the recording, its samples,
its stamps and its promoted points completely intact. And a whole log can be
handed to a tool or a person outside the app through Android's normal share
sheet.

Raw logs are durable-but-disposable evidence: useful for parser debugging,
reprocessing and export; not precious user content.

**Independent of everything downstream of capture.** Can be built in parallel
once recordings exist.

**Blocked by:** `04`.

**Status:** ready-for-agent

- [ ] Per-session raw-log availability and size are shown
- [ ] Aggregate usage is shown, with a **Manage raw logs** action
- [ ] The manager sorts **oldest first**, supports multi-select, and previews the
      space reclaimed before acting
- [ ] Deleting **only** a raw log preserves the session, its samples, stamps,
      legs, spans and promoted points
- [ ] A whole log exports through Android's system save/share surface. **No
      in-app sentence viewer**, and no UI jumping from a sample to its sentences
      — `rawOffset` is parser/debug provenance
- [ ] **Nothing is deleted automatically**: no age limit, storage cap,
      post-promotion deletion, warning threshold or oldest-first eviction
- [ ] **Missing logs are tolerated.** Raw-log-only cleanup does not rewrite
      thousands of sample rows to null their offsets; offsets stay historical
      byte coordinates, unusable when the log is gone. Availability is handled at
      session/file level
- [ ] The manager scans the **directory** as well as database-backed sessions; an
      orphan is shown as an **unlinked raw log** with a retry-delete action, so
      storage never lies to the sailor
