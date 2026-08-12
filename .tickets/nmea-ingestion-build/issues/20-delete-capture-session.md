# 20 — Deleting a capture session is complete withdrawal

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §11.7–9, §12. User stories
90–93.

**What to build:** A session the sailor no longer trusts leaves nothing behind —
its raw log, its samples, its stamps, its legs and spans, and every polar point
it contributed. The confirmation says so plainly, because destroying promoted
polar data by assuming otherwise is not recoverable. And a filesystem problem
never traps them: retry, keep the recording, or delete it anyway.

This is the payoff for provenance. A session recorded with a miscalibrated
paddlewheel is not rejected by the statistics — it is averaged in
proportionally — so being able to take a session back *out* is the useful thing
about knowing where a point came from.

**Blocked by:** `12`, `18`.

**Status:** ready-for-agent

- [ ] Destructive confirmation states plainly that the contributed polar data
      goes too
- [ ] **The file is removed first, then the database graph in one transaction**:
      spans, legs, stamps, connection events, samples, and every promoted polar
      point sourced from that session
- [ ] Fan-out is **explicit in the data-access layer** — no `onDelete` cascades,
      no `PRAGMA foreign_keys`, matching the house convention
- [ ] An already-absent file counts as success
- [ ] If file removal fails, the sailor is offered **retry / keep the recording /
      delete anyway**; the override proceeds with the database deletion
- [ ] Files left behind by an override appear in the raw-log manager as
      **unlinked raw logs** with a retry-delete action — storage never lies
- [ ] If the transaction fails after successful file removal, the session simply
      has no raw log — an already-supported state — and its deletion can be
      retried
- [ ] **No soft-delete**, matching the app's existing convention
- [ ] Deleting a **sail** additionally removes stamps and spans referencing it;
      deleting a **boat profile** fans out to its sessions
- [ ] Withdrawal granularity is the whole session. Per-leg reversal and
      whole-session splices are deliberately out of scope

- [ ] **Rename the raw log before deleting anything.** `getRawLogFileName`
      (`04`) derives `session-<id>.nmea` from a plain `integer primaryKey`, so
      SQLite reuses the rowid once the highest row is deleted — and `openRawLog`
      deliberately never truncates, so `08`'s resume can append to an existing
      log. Today the two only collide if the override path leaves a file behind;
      once deletion is routine, the next recording can be handed the previous
      session's id, find its log already on disk, and append a new race onto the
      old fragment as one file. Make the filename independently unique
      (`startedAt`, or a uuid) and migrate `12`'s filename→session join with it

**Deliberately not built:** per-leg reversal of a promotion, and a whole-session
splice. Review already prevents a bad race reaching promotion, so this only bites
on a promotion regretted after confirming.
