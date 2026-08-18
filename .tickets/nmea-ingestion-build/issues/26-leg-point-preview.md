# 26 — What this leg is worth

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §8, §9. User stories 44–61.
Completes the open criterion in [`14`](14-sailed-legs-and-review-pager.md).

**What to build:** The review screen tells the sailor what their blocks are
actually producing — the polar points this leg would yield, or why it yields
none. The `used` toggle finally sits beside a point count instead of a raw
sample count, so the consequence of striking a leg out is visible while deciding.

**Blocked by:** `18`, `25`.

**Status:** ready-for-agent

## Why a median is the wrong answer

The obvious ask is "show the median speed for the leg". It should be resisted for
three reasons:

- **Nothing downstream consumes it.** Promotion bins by *(sail, 1 kn TWS cluster,
  4° TWA bin)* and takes a median per bin. A leg-wide median is a number that
  looks authoritative and feeds nothing — and on a leg with a peel it blends two
  sails into one meaningless figure.
- **It would be measured over the wrong samples.** Every leg opens with 25 s head
  and 10 s tail guards that are *deliberately* excluded from promotion, plus
  whatever was cut mid-leg. A median over all 387 samples includes time that will
  never become a point.
- **The real answer is small enough to show literally.** Spec §8 and `18` both
  pin the scale: the reference two-hour race yields ~45 points, **median 2 per
  leg**, and *"the screen must read well at 1–4 points per leg"*. No summary
  statistic is needed to stand in for four rows.

A point *is* a median, so showing the points gives the medians for free.

## Acceptance criteria

- [ ] The leg shows the polar points it would yield, **pooled for the leg** — not
      grouped per block, which would reintroduce the nesting `25` removed
- [ ] Each row carries the sail, the TWS cluster, the TWA band, the resulting
      speed, and the sample count behind it
- [ ] **A leg yielding nothing says why**, in the pipeline's own terms — *"longest
      steady stretch 11 s, needs 15 s"*, *"28 qualifying samples at 12 kn / 44°,
      needs 30"*. Spec expects ~2 of 20 legs to legitimately yield zero, and an
      empty list cannot distinguish "the boat was never settled" from "this is
      broken"
- [ ] **The `used` toggle sits beside the point count**, replacing
      `387 samples` — closing `14`'s one remaining open criterion and meeting
      spec §8's *"the toggle beside its point count where the consequence of
      skipping it is visible"*
- [ ] The session screen's leg list carries point counts too
- [ ] Recomputes as blocks are edited. Spec §9 says the steadiness mask runs
      **once, sail-independently** — so cache it per session and re-run only the
      binning when a divider moves
- [ ] Reads well at 1–4 points per leg, and at zero

## The line this must not cross

`18` owns the promotion decision, and the two screens answer different questions:

- **This screen: what would this leg yield.** Points, counts, and why not.
- **`18`'s screen: what does it mean against the table you already have.** The
  delta per 10° band, the TWS range feeding it, the coverage, the confidence cue
  where the stored table has no support.

If this screen starts showing the comparison, promotion degrades into a formality
clicked through — which is exactly what `18` legislated against. Show what the
leg produces; say nothing about whether it is better than what is already stored.

## What makes this cheaper than it looks

Step 1 of spec §9's pipeline — the steadiness mask — **already ships and already
runs on this screen's data**, per leg, at materialisation
(`draftAttribution.ts:314`), returning `medianBoatSpeed`, `medianTws` and
`medianAbsTwa` per stretch. `captureSample` carries every field it needs. Only
steps 3–6 are new, and `18` builds those.

`24` will have measured how much of a real race the mask actually accepts. If
`24`'s steadiness overlay landed, much of this ticket may already be answered
visually, and the rows can be correspondingly quieter — decide that against the
built overlay, not now.
