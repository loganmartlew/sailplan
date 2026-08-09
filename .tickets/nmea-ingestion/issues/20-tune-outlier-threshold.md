# 20 — Tune the steady-state filter's outlier-rejection threshold

Type: task
Status: resolved
Blocked by: —
Map: [map.md](../map.md)

## Question

`07` adopted a per-bin outlier rule for the steady-state filter — reject any
sample more than **3× the median absolute deviation (MAD)** from the bin's
median before taking the final median — as a **tentative default**. Logan's
words: *"I think 3 makes most sense to me, but I can't quantify the risk."*

Quantify it using `14`'s ground-truth simulator rather than argument:

1. Run a scripted-sail lap (`nmea-sim.js sail`) with injected GPS-glitch-style
   outliers (a fault mode `14` already supports, or a minimal addition to it).
2. Score candidate thresholds — at least 2×, 3×, 4× MAD — by how well each
   recovers the known polar (`verify.js`-style comparison against the
   manifest), the same method `14` used to settle `07`'s statistic question.
3. Check whether the right constant is sensitive to bin sample count (a
   30-sample bin vs. a 200-sample bin may tolerate different thresholds) —
   `07`'s minimum-evidence floor is 30.
4. Report the chosen constant and the evidence for it. If 3× turns out wrong,
   this ticket's answer is the correction — `07`'s other seven decisions do
   not need reopening.

Resolved when a threshold is chosen with a measured (not assumed) reason.

## Answer

**Use 4× raw MAD, not the tentative 3×.** For a bin with speed median `m`,
retain an observation `x` when:

```text
|x - m| <= 4 * max(MAD, 0.1 kn)
```

The `0.1 kn` floor is the VHW wire resolution measured by
[Build the NMEA simulator](14-build-the-simulator.md). Without it,
quantised minimum-size bins can have `MAD = 0`, turning every non-identical
reading into an outlier; that occurred in 46 of 5,721 30-sample trials.

### Measurement

The study ran **40 seeded simulations of ten repeated `race.json` laps** (400
laps total). It reproduced
[What counts as a steady-state stretch, and what speed do we take from it?](07-steady-state-filter.md)'s
pipeline: 3 s rolling medians, the 15 s
heading/boat-speed/TWS steadiness test, 1 kn TWS × 4° TWA bins, and the final
median over the original qualifying speed observations. A separate seeded
fault stream replaced 1% of VHW observations with isolated upward spikes at
1.5–3.0× their real value. Candidate constants were scored against the
simulator's known `trueSpeed`, using exact 30- and 200-observation subsets.

| Bin size | MAD | Mean absolute error | p95 absolute error | Glitches rejected | Non-glitches rejected |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 30 | 2× | 1.661% | 6.021% | 100.00% | 25.80% |
| 30 | 3× | 1.629% | 5.625% | 100.00% | 17.67% |
| 30 | **4×** | **1.611%** | **5.275%** | **99.88%** | **12.06%** |
| 200 | 2× | 0.839% | 2.653% | 99.97% | 29.38% |
| 200 | 3× | 0.879% | 2.571% | 99.97% | 20.36% |
| 200 | **4×** | 0.924% | **2.553%** | **99.94%** | **13.21%** |

The dense-bin mean error alone slightly favours 2×, but by only 0.085
percentage points; it rejects another 16.17% of validly observed data and has
a worse tail. Four times MAD is the useful trade: almost unchanged glitch
capture, the best p95 recovery of the required candidates at both sample
counts, and substantially less collateral rejection. **The chosen constant is
not sensitive to 30 versus 200 samples.**

Two sensitivity runs support the boundary:

- At a much harsher 3% rate of 1.5–3.0× spikes, 4× rejected 99.22% (n=30) and
  99.96% (n=200).
- With smaller 1.25–2.0× spikes at the original 1% rate, 4× rejected 94.83%
  and 97.46%. Raising the threshold to 6× reduced non-glitch rejection to
  roughly 5%, but missed 9.49% of those moderate spikes in 30-sample bins;
  this is the knee that rules out simply making the constant still looser.

The final median is already robust enough that rare one-sided spikes barely
move it; the MAD pass matters mainly so corrupted observations do not count as
evidence. Therefore [What counts as a steady-state stretch, and what speed do
we take from it?](07-steady-state-filter.md)'s **≥30 qualifying-sample floor is
checked before** this cleanup, while the promoted point's `n` records the
observations retained after it. That ticket's other seven decisions stand
unchanged.
