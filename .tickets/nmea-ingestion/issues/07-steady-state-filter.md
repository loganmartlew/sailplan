# 07 — What counts as a steady-state stretch, and what speed do we take from it?

Type: grilling
Status: open
Blocked by: 05, 14
Map: [map.md](../map.md)

## Question

The core of founding decision 7's auto-propose path. A race track is mostly
*not* usable polar data — tacks, gybes, acceleration out of manoeuvres, luffing
for a start, sailing in someone's dirty air, and simply sailing the boat badly
all produce speeds that don't belong in a polar.

1. **The steadiness test.** What makes a stretch usable? Working proposal:
   heading stable within ±X° and boat speed and TWS each stable within some
   band, all held for N seconds. Settle X, the bands, and N — and whether the
   test is on raw samples or a smoothed series.
2. **Manoeuvre exclusion.** Is excluding manoeuvres a consequence of the
   steadiness test, or does it need its own detector (a tack is a large,
   *fast* heading change through the wind)? Also: how long after a tack before
   the boat is back up to target and the data is usable again?
3. **Binning.** What TWS and TWA bin widths do proposals use? Note the existing
   engine already clusters at 1 kn TWS and 4° TWA
   (`buildClusteredPolarGrid`) — should promotion match those, so proposed
   points land on the structure the interpolator expects, or stay independent?

   **`03` narrowed this.** Promoted points are never pooled with imported ones
   — each source is interpolated on its own grid and the answers blended — so
   "match the imported table's structure" is no longer a consideration. What
   remains is whether promotion's bins should match the *clustered* grid's,
   since captured data will be served by that path. Note also that `03`
   measured what happens when a capture's TWS range has no >1 kn gaps in it:
   the whole range collapses into a single clustered column at the mean TWS.
   If promotion emits points at bin centres, that collapse is avoided; if it
   emits raw scatter, it is not.
4. **The statistic. `12` produced a number that challenges founding decision
   7.** Measured against the noise model already in
   `polars/generate-polars.js` (20% at 0.82–0.92×, 65% at 0.97–1.03×, 15% at
   1.05–1.15×), the true speed sits at roughly the **52nd percentile** — so a
   **90th-percentile derivation overstates the polar by ~8.3%**, and a 75th by
   ~2.1%.

   That reframes the question. "High percentile" was chosen because polars
   describe *best achievable* speed, but a percentile over a noisy bin
   measures **instrument and sea-state noise**, not sailing skill — and taking
   the top of the noise distribution is simply a measurement bias.

   These are two different things and the ticket must separate them:
   - **Noise** — symmetric-ish measurement scatter. Wants the **median**,
     which is why the existing `buildClusteredPolarGrid` uses one.
   - **Sailing quality** — genuinely asymmetric; most moments are worse than
     the boat's potential. Wants a **high percentile**.

   A percentile applied to a bin conflates them. Consider whether the
   steadiness filter in question 1 should do the sailing-quality work
   (by excluding badly-sailed stretches *before* binning), leaving the
   statistic free to be a plain median. Settle this with `14`'s ground-truth
   harness rather than by argument — the whole point of building it was to
   make this measurable.

   Also resolve the interaction with the existing clustered grid's median.

   **`03` adds a constraint here: whatever statistic is chosen is applied
   once, at promotion, and interpolation must not re-apply it.** The
   collision rule for stored points (`15`) is therefore deliberately neutral —
   if promotion has already taken a high percentile for "target" and query
   time took a max as well, the optimism compounds. Decide this statistic
   knowing nothing downstream will add to it.
5. **Minimum evidence.** How many samples must a bin contain before it earns a
   proposed point? A 95th percentile of four samples is just the maximum.
6. **Outliers.** A GPS glitch or a wave surf can produce a speed the boat
   cannot sustain. Is there a plausibility ceiling, and where does it come
   from?
7. **Both tacks.** Port and starboard data for the same TWA should agree. Do
   they get merged, or kept apart so a rig or calibration asymmetry is
   visible? This is the cheapest available signal for the calibration fog.
8. **Manual selection.** The same ticket owns the fallback path: when you
   hand-select a stretch, what statistic does *it* use, and does it apply the
   steadiness test at all or trust you completely?

## Answer

<!-- filled on resolution -->
