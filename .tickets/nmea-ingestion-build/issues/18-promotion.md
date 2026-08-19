# 18 — Promotion: from confirmed spans to polar points

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §9. User stories 68–75, 78.

**What to build:** The race becomes polar points — but only from the stretches
where the boat was genuinely settled, so the polars describe the boat rather than
the manoeuvres. A bin needs real evidence before it proposes anything, glitches
are rejected before the final number is taken, and the sailor sees the whole
result as a comparison against their existing table — per sail, per 10° TWA band,
with the delta — **before anything is written**. Promotion is a decision, not a
side effect of finishing review.

**The filter does the sailing-quality work so the statistic only has to handle
measurement noise.** That is why the statistic is a median and not a percentile.

**Blocked by:** `01`, `15`.

**Status:** ready-for-human

- [x] **Steadiness test**: heading within ±5° of the window mean, boat speed
      within ±5 %, TWS within ±1 kn, all held for **≥15 consecutive seconds**,
      tested on a **3 s rolling median** of raw samples
- [x] The mask runs **once, sail-independently**, and is shared with `17`'s
      regime detection — one mask, three consumers
- [x] **Manoeuvre exclusion is a consequence, not a detector**: a tack breaks the
      ±5° heading band on its own, so nothing extra needs keeping in sync when
      the bands are retuned
- [x] Promotion **intersects** confirmed spans with that mask; only confirmed
      spans can produce points
- [x] **Binning matches the clustered grid exactly** — 1 kn TWS clusters, 4° TWA
      bins, points emitted at **bin centres**, so a promoted point lands where
      the interpolator will look for it
- [x] **Minimum evidence ≥30 qualifying samples per bin** — roughly two
      independent ≥15 s stretches — checked **before** outlier cleanup. Bins that
      do not reach 30 are simply not proposed
- [x] Outlier rejection `retain x ⇔ |x − m| ≤ 4 × max(MAD, 0.1 kn)`, where `m` is
      the bin's median. The **0.1 kn floor is the wire resolution**; without it a
      quantised minimum-size bin can have `MAD = 0` and reject every non-identical
      reading
- [x] **The statistic is the median**, applied once, at promotion. Nothing
      downstream re-applies it — the interpolation-time collision rule is
      deliberately neutral so optimism cannot compound
- [x] **Both tacks merge to `|TWA|` at promotion** (samples keep signed TWA right
      up to this point)
- [x] A leg is allowed to yield nothing
- [x] The promotion review is a **table per sail per 10° TWA band**: the band, the
      TWS range feeding it, what this race says, what the table says, the delta,
      and the point count. Not a scatter of dots — a scatter gives nothing to
      argue with
- [x] Where the stored table has no support, a **confidence cue** rather than a
      bare delta
- [ ] **The screen reads well at 1–4 points per leg** — built for that scale
      (the race script yields 0–4 per leg; see the last box), but reading well
      is a device judgement and spec.md lists it among the things to verify on
      hardware. Not claimed from a test run
- [x] Written points carry `sourceKind: 'capture'` and their `captureSessionId`,
      through the same single insert path
- [x] A second promotion from the same session **replaces** that session's points
      rather than accumulating alongside them
- [x] `replayCaptureSession` extended to return `proposedPoints`
- [x] Tested against the race script — **31 points, median 1 per leg, 4 legs
      yielding nothing**, not the ~45 / 2 / 2 recorded here. That estimate
      predates `nmea-sim/scripts/wl-race.json`. Two causes, both deliberate:
      bins are scoped to the **leg** (the spec bins on sail/TWS/TWA and says
      nothing about legs — but "a leg is allowed to yield nothing" and `26`'s
      per-leg preview both need it, and evidence from two legs an hour apart is
      not the repeat the 30-sample bar is asking for); and regenerated at
      7,660 s the script's oscillating wind (±8° TWD over 300 s, ±1.5 kn TWS
      over 420 s) spreads the evidence widely. Between them the race lands in
      297 leg-scoped bins, of which 31 reach the 30-sample minimum. The shape the number is quoted for holds: 0–4 points per leg,
      and legs that legitimately yield none. Fixture:
      `wl-race-sailed.log` + manifest, with the simulator's own grid as truth
      (median error 0.11 kn)
