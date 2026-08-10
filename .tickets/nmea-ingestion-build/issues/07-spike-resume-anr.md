# 07 — Spike: the resume ANR

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §2, carried from device spike
`13` as an implementation risk.

**What to build:** Returning to the app during a recording does not hang it.
`13` reproduced an ANR roughly 5 s after the app returns to `active`, on real
hardware, and did not root-cause it. The spec says to budget time for it; this is
that budget.

**Why it is race-critical rather than a tidy-up:** returning the app to the
foreground is exactly the interaction stamping depends on. An ANR there is an
ANR on the one thing the sailor has to do while racing.

**Blocked by:** `04`.

**Status:** ready-for-agent

- [ ] The ANR is reproduced on real hardware and the trigger is characterised
      (what runs ~5 s after `app_state → active`)
- [ ] Root cause identified and written up in the ticket's comments
- [ ] Fixed — or, if it cannot be, the residual risk is documented with a
      mitigation and a way for the sailor to recover
- [ ] Returning to the app to stamp a sail does not ANR, verified across ten
      resume cycles inside one race-length recording
- [ ] Whatever is learned is recorded against the finding, not just the fix — the
      cause matters for the rest of the service work
