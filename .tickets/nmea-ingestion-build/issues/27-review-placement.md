# 27 — Review does not live where the sailor is

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8.

**What to build:** Not yet decided — this records the problem so it does not
evaporate.

**Blocked by:** nothing. Deliberately not scheduled.

**Status:** needs-triage

## The problem

A recording starts in the Plan flow (`app/(plan)/course/plan.tsx:132`) and is
tracked by a bar mounted app-wide (`_layout.tsx:139`). Its result is then filed
under **Settings → Capture Sessions → session → review** — four levels deep,
behind a gear icon, in the same menu as Units and Appearance.

The loop never closes where it started, and the one thing the whole capture
feature exists to produce is the hardest thing in the app to find.

The failure mode is not "annoying to reach". It is that **a session nobody
reviews contributes nothing, and nothing anywhere says one is waiting.** Sessions
rot silently.

## Options considered, not chosen

- **Leave it.** Review is occasional; Settings is a reasonable archive. Chosen
  for now, on the grounds that `24`/`25` should not also be a navigation change
- **A top-level tab.** Wrong for a once-a-week task, and all five tabs
  (Plan, Marks, Courses, Sails, Settings) are earning their place
- **Surface unreviewed sessions where the sailor already is** — a prompt in the
  Plan flow when a session ends unreviewed, keeping Settings as the archive.
  The favourite. There is direct precedent: `useCaptureResumeOffer`
  (`captureResume.ts`) already surfaces a *resumable* session in the Plan flow,
  keyed to the current course. An unreviewed-session prompt is the same mechanism
  on a different trigger

`25` makes this cheap whenever it is picked up: `reviewedAt` is exactly the flag
such a prompt needs, and it does not exist today.

## Open questions

- Does the prompt appear once and dismiss, or persist until the session is
  reviewed or explicitly dismissed?
- Does it belong to the Plan flow specifically, or anywhere the recording bar
  already appears?
