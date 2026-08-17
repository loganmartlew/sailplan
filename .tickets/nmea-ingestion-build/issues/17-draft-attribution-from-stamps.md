# 17 — Draft attribution from sparse stamps

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §7. User stories 62–67.

**What to build:** The sailor stamped on one beat and not the next, hoisted late,
peeled early, and missed one change entirely. From that, SailPlan proposes
editable sail-attribution spans — drafts, never new evidence — so a third of the
race is not stranded for want of a re-announcement nobody would make, and no
sample is ever attributed to a sail that was not up.

**A sail stamp means only *this sail was up at this instant*.** It never remains
in force and never, by itself, claims its containing leg. **Review edits spans
and never creates stamps** — a review-time correction that manufactured a stamp
would launder an inference into evidence.

**Blocked by:** `06`, `15`.

**Status:** done

- [x] A stamp seeds a draft span in the sailed leg containing it, keeping the
      default unused head and tail guards
- [x] It may seed **one immediately adjacent unstamped leg** when *all* of: the
      two legs' median `|TWA|` fall in the same **10° review band**; their median
      TWS values are within **2 kn**; there is no conflicting stamp; and there is
      no sustained boat-speed regime change
- [x] **One hop from evidence, never recursive** — a missed sail change cannot
      walk the wrong sail through the whole race
- [x] TWA **sign is ignored**, so a tack or gybe does not stop attribution when
      the point of sail is unchanged (measured necessity: 5 of 17 legs in the
      reference race had no stamp, every one was the leg straight after a tack,
      and carry-forward scored 5/5 against truth)
- [x] Boat speed **finds boundaries; it does not identify sails.** A speed shift
      >5 % becomes a candidate boundary only when the new regime forms a **≥15 s
      steady stretch** on the same 3 s rolling medians the steadiness filter uses
- [x] The interval between the last qualifying stretch of the old regime and the
      first of the new is proposed **not used** — hoists, drops and manoeuvre
      transients feed neither sail
- [x] Two different-sail stamps in one leg: each sail extends toward a credible
      boundary; with no credible boundary the interval between them stays
      unattributed and is **never split at an invented midpoint**
- [x] **Fails closed.** No stamp, only a distant stamp, no qualifying steady
      stretch, or disagreeing similarity tests → propose **not used**
- [x] The rule **never** selects a sail because that sail's existing polar
      predicts the observed speed — the polars cannot confirm themselves
- [x] **Three categorical states only** — draft, confirmed, not used. No numeric
      attribution confidence: a second trust knob competing with the evidence
      rules is the pathology `03` and `15` already threw out
- [ ] Only **confirmed** spans can produce polar points
      — *nothing gates on this yet: no code reads `confirmedAt` to decide what
      feeds the polar, because promotion is `18`. The gate must be `confirmedAt`
      **and** `sailedLeg.used` — a null `sailId` no longer means "struck out".*
- [x] `replayCaptureSession` extended to return `draftSpans`
- [x] Tested against the race script with the deliberately bad stamps: the late
      hoist is excluded by the head guard; the early peel produces separate
      regions with an unused transition; the missed hoist leaves the leg **not
      used** rather than wrongly attributed

## Verification

- `npx jest features/capture/util/__tests__/replayCaptureSession.test.ts --runInBand`
- `npx tsc --noEmit`
- `npm run lint` (0 errors; 19 pre-existing warnings outside this change)
- `npx jest --runInBand` (36 suites, 388 tests)
