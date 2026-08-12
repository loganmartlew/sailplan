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

**Status:** ready-for-human

- [~] The ANR is reproduced on real hardware and the trigger is characterised
      (what runs ~5 s after `app_state → active`). **Not reproduced** across two
      forced-Doze runs, one of 13.7 min. The trigger *is* characterised, and it
      is not what `13` thought — see Findings
- [x] Root cause identified and written up in the ticket's comments. `13`'s
      hypothesis is **disproven**; the true cause is not yet known, and the
      measurements narrow it sharply
- [~] Fixed — or, if it cannot be, the residual risk is documented with a
      mitigation and a way for the sailor to recover. **Residual risk
      documented** below; nothing to fix until it reproduces
- [ ] Returning to the app to stamp a sail does not ANR, verified across ten
      resume cycles inside one race-length recording. **Blocked on time, not on
      knowledge** — needs an unattended race-length run
- [x] Whatever is learned is recorded against the finding, not just the fix — the
      cause matters for the rest of the service work

## Findings — MT5, 2026-08-12

Measured with throwaway instrumentation
(`features/capture/util/captureDiagnostics.ts`) on an ASUS AI2302, Android 15,
against the `nmea-sim` hotspot rig. Procedure and raw results in
[`manual-tests/mt5-resume-anr.md`](../manual-tests/mt5-resume-anr.md).

### `13`'s leading hypothesis is disproven

`13` proposed that socket `data` delivery to JS is deferred while backgrounded
and arrives as a catch-up burst on resume, blocking the main thread past
Android's 5 s input-dispatch timeout — and that the same backlog explained its
sample-thinning. Over **13.7 minutes backgrounded in deep Doze**:

| Measurement | Value |
| --- | --- |
| Largest inter-event gap, whole background span | **0.2 s** |
| Timer ticks (1 Hz JS interval) | **904 in 908 s** |
| Data events in the 10 s after `active` | **102** |
| Per-second counts in that window | `11,11,10,10,10,9,10,10,11,10` |
| Total synchronous appends in that window | **141 ms**, worst single 2.14 ms |

There is **no deferral, no backlog, and no burst**. The resume window is
statistically indistinguishable from any other ten seconds of the run, and its
append cost sits 35× below the ANR threshold. The `JavaTimerManager` stall `13`
inferred from item 4 did not occur either.

**Consequence for `05`:** the coalesce-window redesign `13` opened on the
strength of this hypothesis is not needed for this reason. If thinning is real
it has another cause.

### What is still open

The ANR did not reproduce, so it is not root-caused — but three of the four
candidates are now excluded **by measurement** rather than elimination: the
resume burst, the synchronous appends, and the timer backlog. What remains is
RNBA's own resume handling, or something unnamed. Note `13` found it on a
*naturally* backgrounded phone over ~90 min; forced Doze is not the same
condition, and that difference is the most likely reason for the
non-reproduction.

### Incidental: append cost triples in Doze, and it does not matter

Mean append rose 1.70 ms → ~4.9 ms once the screen was off, then fell to
1.44 ms on resume **while the file was at its largest** — so this is CPU
frequency scaling, not the raw log growing. No action; recorded so the next
person does not re-derive it.

## Residual risk

**The ANR is a hang, not data loss.** The blocked main thread is blocked *doing
the appends* — the raw log is being written throughout. Race-day mitigation:
avoid foregrounding the app mid-race, and if it does hang, **wait rather than
force-stop** — force-stopping is the only action that costs the recording.

This is cheap to accept right now because `06` is not built: with no stamping
there is no reason to foreground the app during a race at all.

**Reassess when `06` lands**, because that is what makes resume a routine
interaction rather than an avoidable one.
