# 06 — Raw log retention and cleanup

Type: grilling
Status: resolved
Blocked by: 01
Map: [map.md](../map.md)

## Question

Founding decision 2 keeps the raw sentence stream in a file so a parser bug
doesn't destroy an unrepeatable race. That file is the only part of this
feature with a real storage cost — at ~30 sentences/sec it's on the order of
10+ MB per race. Size it from `01`'s documented rate; `04` confirms it later.

Settle the policy:

1. **Is the raw log opt-in or always on?** Always-on is safest while the parser
   is young; opt-in respects the phone's storage. Does that answer change once
   the parser is trusted?
2. **When is it deleted?** Candidates: never (manual only); on a timer (N days);
   once the session's points have been promoted to polars; when total raw
   storage crosses a cap, oldest first. These aren't exclusive.
3. **Who deletes it?** Automatic, or a visible "clean up" action so nothing
   disappears behind your back? The user explicitly asked for a *good cleanup
   method* — establish whether that means automatic hygiene or a manual tool.
4. **Deleting a session.** Does deleting a capture session delete its raw log,
   its samples, and its promoted polar points — or are those independent? Note
   this interacts with the provenance column: promoted points may be the only
   thing still worth keeping.
5. **Visibility.** Does the app show storage used per session, so the decision
   to delete can be informed?
6. **Where on disk?** `expo-file-system` offers cache versus document
   directories; the cache directory can be reclaimed by Android without
   warning, which is either a feature or a data-loss bug depending on intent.

> **`05` added a constraint.** Every sample row carries a **`rawOffset`** — a
> byte offset into the raw log — so review can jump from a suspicious sample
> straight to the sentences that produced it. Deleting or truncating the log
> therefore **dangles every offset in that session**. Retention isn't only about
> disk any more: it decides whether a session stays auditable. Whatever this
> ticket chooses must say what a dangling offset does (nulled on delete, or
> tolerated and handled at read time).

## Answer

The raw log is **durable-but-disposable evidence**: useful for parser debugging,
future reprocessing and export, but not precious user content. The policy is:

1. **Always record it.** Raw logging is not opt-in and does not switch off when
   the parser is considered mature. Every recording gets one verbatim raw log.
2. **Store it durably.** Logs live in a dedicated directory under app document
   storage, with predictable session-based filenames. They never live in the
   Android-reclaimable cache directory.
3. **Never delete automatically.** There is no age limit, storage cap,
   post-promotion deletion, warning threshold or oldest-first eviction in v1.
   Cleanup always requires a user action.
4. **Make manual cleanup good.** Show raw-log availability and size on each
   recording, aggregate raw-log usage, and a **Manage raw logs** action. The
   manager sorts oldest-first, supports multi-select, and previews the space to
   be reclaimed. Raw-log-only cleanup preserves the recording, parsed samples,
   stamps and promoted polar points.
5. **Export the whole artifact.** A recording offers **Export raw NMEA log**
   through Android's system save/share surface. There is no in-app sentence
   viewer and no UI for jumping from a sample to its source sentences.
   `rawOffset` remains parser/debug provenance rather than a user-facing link.
6. **Tolerate missing logs.** Raw-log-only cleanup does not rewrite thousands
   of sample rows to null their `rawOffset`; offsets remain as historical byte
   coordinates and are simply unusable when the session has no raw log. Log
   availability is handled at session/file level.
7. **Deleting a recording is complete withdrawal.** After destructive
   confirmation, hard-delete its raw log, samples, stamps, and every promoted
   polar point sourced from it. This matches the app's existing hard-delete
   convention; no archive or soft-delete state is introduced. The confirmation
   must say plainly that the recording's contributed polar data will also go.
8. **Handle the filesystem/SQLite gap explicitly.** Try to remove the file
   first, then remove the database graph in one SQLite transaction. A file that
   is already absent counts as success. If file removal fails, offer three
   plain-language choices: retry, keep the recording, or delete the recording
   anyway. Choosing the override proceeds with the database deletion.
9. **Do not hide leftovers.** The raw-log manager scans the dedicated directory
   as well as database-backed recordings. A file left behind by the override is
   counted and shown as an **unlinked raw log**, with a later retry-delete
   action. If the database transaction fails after successful file removal, the
   recording remains without a raw log, which is already a supported state, and
   its deletion can be retried.

No further ticket emerged: this settles capture default, retention, cleanup,
visibility, export, dangling-offset behaviour, session deletion and failure
recovery together.
