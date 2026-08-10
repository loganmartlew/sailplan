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

**Status:** ready-for-agent

- [ ] **Steadiness test**: heading within ±5° of the window mean, boat speed
      within ±5 %, TWS within ±1 kn, all held for **≥15 consecutive seconds**,
      tested on a **3 s rolling median** of raw samples
- [ ] The mask runs **once, sail-independently**, and is shared with `17`'s
      regime detection — one mask, three consumers
- [ ] **Manoeuvre exclusion is a consequence, not a detector**: a tack breaks the
      ±5° heading band on its own, so nothing extra needs keeping in sync when
      the bands are retuned
- [ ] Promotion **intersects** confirmed spans with that mask; only confirmed
      spans can produce points
- [ ] **Binning matches the clustered grid exactly** — 1 kn TWS clusters, 4° TWA
      bins, points emitted at **bin centres**, so a promoted point lands where
      the interpolator will look for it
- [ ] **Minimum evidence ≥30 qualifying samples per bin** — roughly two
      independent ≥15 s stretches — checked **before** outlier cleanup. Bins that
      do not reach 30 are simply not proposed
- [ ] Outlier rejection `retain x ⇔ |x − m| ≤ 4 × max(MAD, 0.1 kn)`, where `m` is
      the bin's median. The **0.1 kn floor is the wire resolution**; without it a
      quantised minimum-size bin can have `MAD = 0` and reject every non-identical
      reading
- [ ] **The statistic is the median**, applied once, at promotion. Nothing
      downstream re-applies it — the interpolation-time collision rule is
      deliberately neutral so optimism cannot compound
- [ ] **Both tacks merge to `|TWA|` at promotion** (samples keep signed TWA right
      up to this point)
- [ ] A leg is allowed to yield nothing
- [ ] The promotion review is a **table per sail per 10° TWA band**: the band, the
      TWS range feeding it, what this race says, what the table says, the delta,
      and the point count. Not a scatter of dots — a scatter gives nothing to
      argue with
- [ ] Where the stored table has no support, a **confidence cue** rather than a
      bare delta
- [ ] **The screen reads well at 1–4 points per leg** — the reference two-hour
      race yields ~45 points, median 2 per leg, with 2 legs yielding nothing
- [ ] Written points carry `sourceKind: 'capture'` and their `captureSessionId`,
      through the same single insert path
- [ ] A second promotion from the same session **replaces** that session's points
      rather than accumulating alongside them
- [ ] `replayCaptureSession` extended to return `proposedPoints`
- [ ] Tested against the race script for ~45 points, median 2 per leg, 2 legs
      yielding nothing
