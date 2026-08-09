# 20 — Tune the steady-state filter's outlier-rejection threshold

Type: task
Status: open
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

<!-- filled on resolution -->
