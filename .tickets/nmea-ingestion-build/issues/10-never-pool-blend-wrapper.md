# 10 — Never pool sources: the blend wrapper on the read path

Spec: [`spec.md`](../../nmea-ingestion/spec.md) §10, plus Testing Decisions
Seam 2.

**What to build:** Measured points are never pooled with imported or
hand-entered ones. Each source is interpolated on its own grid and the answers
blended at an explicit, named weight, with measured data contributing only where
it actually has coverage near the conditions being asked about. Today that
changes nothing the sailor sees — no capture data exists yet — which is exactly
the point: the machinery lands and the existing suggestion behaviour is provably
unchanged.

Pooling is already a blend, just an uncontrolled one: it behaves like a weight of
roughly 0.45 set by point counts and clustering luck, and it collapses whatever
contiguous TWS run has no >1 kn gap into a single column. There is a physical
reason too — captured wind is masthead-height and instrument-corrected, imported
wind is 10 m free-stream: 5–9 % apart in TWS and 3–5° in TWA.

**Independent of the whole capture path.** This can be built in parallel with
anything after `01`.

**Blocked by:** `01`.

**Status:** done

- [x] A wrapper **above** the existing interpolation entry point partitions
      points by `sourceKind`, calls the existing estimator **once per source**,
      and blends the answers
- [x] **The existing interpolation entry point is not modified.** The existing
      polar-interpolation tests keeping their contract unchanged is itself the
      regression test that the engine was not touched
- [x] Existing callers swap one import; `suggestSails`, `evaluateSail` and
      `rankSails` tests still pass as the top-level behavioural seam
- [x] The separation predicate is **`sourceKind = 'capture'`** — a plain indexed
      column, not a join, so every future non-capture kind lands on the correct
      side automatically
- [x] **Capture sessions pool with each other** (measured strictly good:
      3.33 % → 2.58 % → 2.09 % error as sessions accumulate)
- [x] The weight and the coverage radius are **named exported constants**, marked
      in code as pending ticket `16`: measured weight **0.5** inside coverage,
      radius **±1 kn TWS and ±10° TWA**, tapering linearly to zero across the
      outer half. **Do not treat these as validated**
- [x] Outside coverage, imported and manual points answer alone; the imported
      grid stays exact at every weight
- [x] **No additional knobs.** `16` moves those two numbers and nothing else — see
      the spec's note on the recurring "second implicit trust knob" failure
- [x] Where the stored table has no support, the read path can surface a
      **confidence cue** rather than a bare number
- [x] New tests assert behaviours, not arithmetic: imported points alone answer
      outside coverage; captured points contribute inside it; capture sessions
      pool; the weight is read from the constant rather than emerging from point
      counts
- [x] If the opt-in accuracy sweep's locked baseline moves, it is re-ratcheted
      **deliberately**, never silently
