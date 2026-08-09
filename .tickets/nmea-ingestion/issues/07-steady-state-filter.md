# 07 — What counts as a steady-state stretch, and what speed do we take from it?

Type: grilling
Status: resolved
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

Settled by grilling. Two ideas underlie all eight sub-answers: the steadiness
filter does the *sailing-quality* work (deciding which moments represent real
performance) so the bin statistic only has to handle *measurement noise*
(median), and every stage that needs robustness reaches for the same
robust-statistics family (median, MAD) rather than inventing a second implicit
trust knob — the exact pathology `03` and `15` already ruled out elsewhere on
this map.

1. **Steadiness test.** Heading within ±5° of the window's mean, boat speed
   within ±5%, TWS within ±1 kn, all held for **≥15 consecutive seconds**,
   tested on a **3 s rolling median** of raw samples — enough to absorb the
   0.1°/0.1 kn wire quantisation `14` measured without smearing a real
   manoeuvre transition (15 s ≫ 3 s).
2. **Manoeuvre exclusion** is a consequence of the steadiness test, not a
   separate detector. A tack or gybe is a large, fast heading change — it
   breaks the ±5° band on its own, so the window never reaches 15 s during or
   immediately after one. No second thing to keep in sync with the bands if
   they're retuned.
3. **Binning** matches the clustered grid exactly: 1 kn TWS clusters, 4° TWA
   bins, points emitted at **bin centres**. Captured data is only ever served
   through `buildClusteredPolarGrid` (per `03`'s never-pool decision), so
   promoting at that grid's own resolution means a proposed point lands where
   the interpolator will actually look for it, and emitting at bin centres —
   rather than raw scatter — is what avoids `03`'s single-column collapse when
   a race's TWS range has no >1 kn gaps.
4. **The statistic is the median**, taken *after* the steadiness filter has
   already excluded badly-sailed stretches. `12`/`14`'s percentile-overstatement
   finding (p90 +3.1%, p75 nearly unbiased at +0.9%, measured over a whole
   *unfiltered* lap) doesn't override this: once the filter has done the
   sailing-quality work, what's left in a bin is closer to symmetric
   measurement noise, which is exactly what median is for — and it's what
   `buildClusteredPolarGrid` already uses, so promotion and query share one
   statistic philosophy rather than two.
5. **Minimum evidence**: a bin needs **≥30 qualifying samples** (roughly two
   independent ≥15 s stretches, not just one long one) before it earns a
   proposed point. Requiring more than one stretch means the median reflects
   the boat settling into a condition repeatably, not one stretch's particular
   trim or wave state. Bins that don't reach 30 simply aren't proposed.
6. **Outlier ceiling**: per-bin **MAD-based rejection** — reject samples more
   than **3× the median absolute deviation** from the bin's median before
   taking the final median. Self-calibrating per boat/bin, no boat-specific
   max-speed config to invent. **The 3× constant is a tentative default, not a
   validated one** — Logan flagged he can't yet quantify the risk of it being
   wrong. Follow-up: `20`, which tunes it against `14`'s ground-truth
   simulator rather than blocking this ticket on that measurement.
7. **Both tacks are merged to `|TWA|` at promotion.** `sailPolar` already
   stores TWA as an unsigned 0–180° magnitude (confirmed by reading
   `schema.ts` and `polars/fleet.js`) — the schema assumes port/starboard
   symmetry. Captured samples keep signed TWA (`05`'s decision, needed for
   coalesce/staleness logic) right up to the point of promotion, where they
   fold to the existing convention so promoted points need no schema change.
   Port/starboard asymmetry as a calibration signal — this ticket's own text
   called it "the cheapest available signal for the calibration fog" — is
   **not solved here**; preserving it would need a `tack` column touching
   interpolation, charts, and CSV import/export, well beyond promotion's
   blast radius. Left in **Not yet specified** on the map, folded into the
   existing calibration fog.
8. **Manual selection** still runs the steadiness test, but as a **warning,
   not a hard block** — the user can override it having seen the warning. Once
   a stretch is selected (auto or manual), it goes through the same binning,
   median, and MAD-outlier-rejection as the auto-propose path — there's no
   reason to compute a selected stretch's representative speed differently
   from a filter-found one.

New: `20` — validate the 3× MAD constant against `14`'s simulator (candidate
values 2×/3×/4×, scored by how well each recovers the known polar over a
scripted-sail lap with injected GPS-glitch-style outliers). Not blocking;
`07`'s other seven answers stand regardless of its outcome.

Unblocks `08` (schema — inherits promoted-point shape: bin centres, `n`,
median, MAD-filtered), `09`/`10` (UX can now show what a proposal is and why
it warns on manual override), and `19` (already blocked on `07` for exactly
this: how the steadiness filter and the stamp-attribution rule compose).
