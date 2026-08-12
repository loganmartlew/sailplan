# 08 — Losing and regaining the plotter

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §4. User stories 32–41.

**What to build:** A dead feed is never silent. The moment data stops the live
values grey out, a **Retrying** bar appears with the gap age, the notification
changes, and the phone buzzes distinctly — once, then one reminder a minute
later, then nothing, so the alert never becomes noise. SailPlan keeps retrying on
a backoff, so a plotter reboot or a walk to the foredeck does not end the race.
When data returns, the *same* recording continues with the outage preserved as a
gap. When it does not, the recording ends itself at the last valid sample rather
than running the service all night — and offers to resume if the sailor is still
aboard.

**Blocked by:** `04`, `05`, `06`.

**Status:** ready-for-human

- [x] **One policy, measured from the last valid NMEA anchor data**, so a
      connected-but-silent socket is covered as well as a closed one
- [x] Live values grey out and a **Retrying** bar with the gap age appears
      immediately on loss
- [x] The notification changes to **Connection lost — retrying** immediately
- [x] A distinct vibration ~5 s after the loss, one reminder at 60 s, then **no
      more**; one short confirmation vibration on recovery; one final vibration
      at auto-end
- [x] Retry immediately, then at 1 s, 2 s, 5 s and 10 s, then every 15 s
- [x] Recovery continues **the same capture session**; the outage is preserved as
      a `connectionEvent` gap. **No manufactured empty sample rows, ever**
- [x] Auto-end at a **named constant defaulting to 30 minutes** — the spec call
      softening `11`'s five minutes for this build, reverting once ticket `21`
      has characterised real dropouts. The constant is the only thing softened
- [x] Auto-end sets the end time to the **last valid sample** so trailing silence
      contributes nothing, sets `status: 'autoEnded'`, stops the service, and
      posts a `Recording ended — plotter data lost` notification
- [x] **Resume recording** appears only in that notification and on the original
      course's plan screen; it reconnects, waits for valid data, reopens the
      **same** session, keeps the outage as a gap, and advances the end time when
      capture later stops
- [x] The resume offer disappears on dismissal (`resumeDismissedAt`), on another
      recording starting, or on that session's data being confirmed — whichever
      comes first. It is never offered later from session history
- [x] A recording stopped **deliberately** can never resume, and recovery never
      starts a new session automatically
- [x] Resumability is **derived**, not a fourth status: `autoEnded` ∧ no
      `resumeDismissedAt` ∧ no later session ∧ nothing confirmed
- [ ] Verified on hardware: screen-off reconnect, the vibration escalation, and
      service shutdown at the auto-end horizon

## Comments

- 2026-08-12: Software implementation complete. The recorder now monitors valid
  anchor silence and socket failures through one retry policy, persists paired
  `lost`/`recovered` events without gap samples, auto-ends at the final parsed
  sample, and can explicitly reopen the same session after valid data returns.
  The capture layer, foreground notification, finite vibration escalation, and
  auto-end Resume/Dismiss notification are wired. Resumability is derived on
  both the course-plan and notification paths. Automated verification: strict
  typecheck, lint (existing warnings only), and 305 Jest tests. Hardware
  verification remains, so the ticket is handed to `ready-for-human` rather
  than marked `done`.
