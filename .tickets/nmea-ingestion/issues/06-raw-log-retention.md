# 06 — Raw log retention and cleanup

Type: grilling
Status: open
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

<!-- filled on resolution -->
