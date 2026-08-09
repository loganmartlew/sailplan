# 17 — How is true wind actually derived, properly?

Type: research
Status: resolved
Blocked by: —
Map: [map.md](../map.md)
Findings: [research/17-true-wind-derivation.md](../research/17-true-wind-derivation.md)

## Question

`05` proposed that the app derive **water-referenced true wind itself** from
apparent wind + STW + heading, rather than trusting the instrument's `MWV,T`
— because that works on any boat with no per-boat configuration, and because
NMEA 0183 cannot say which reference frame its `T` flag means (see `01`).

Before committing to that, establish **how true wind is correctly computed in
real marine instrument systems**, so a home-grown derivation doesn't quietly
produce worse numbers than the instrument it replaced.

Specifically:

1. **The textbook vector math** — the exact formulation used to go from
   (AWA, AWS, boat velocity) to (TWA, TWS, TWD), and the sign/convention traps
   in it.
2. **What real systems correct for beyond the naive vector subtraction.** At
   minimum, investigate: **heel/mast-tilt correction**, **upwash/deflection**
   at the masthead, **wind gradient / sensor height**, **mast rotation or
   twist**, **leeway**, and **sensor lag/damping**. For each: what is the
   correction, how large is the error without it, and what inputs does it need
   (the Zeus 3 emits heel/trim via `XDR`).
3. **Which of those corrections a B&G / Navico system applies internally**
   before it puts `MWV,T` on the wire. This is the crux: if the instrument
   applies corrections we cannot reproduce (because their inputs never reach
   the 0183 stream, or the algorithm is proprietary), then deriving ourselves
   is *worse*, and the right answer is to trust `MWV,T` and detect its
   reference frame instead.
4. **Water- vs ground-referenced in practice** — how systems that expose both
   choose, and whether a boat's `MWV,T` frame is knowable from the stream.
5. **What "good enough for polars" actually requires.** Polar bins are 1 kn
   TWS / 4° TWA. Which corrections matter at that resolution and which are
   noise below it?

Deliver a recommendation: **derive ourselves**, **trust the instrument**, or
**derive as a cross-check only** — with the error magnitudes that justify it.

## Answer

**Trust `MWV,T` for polar TWA/TWS. Derive independently as a session-level
cross-check only — never as the value written to a polar point, and never
blended.** Full findings, with sources and arithmetic:
[research/17-true-wind-derivation.md](../research/17-true-wind-derivation.md)
(branch `research/17-true-wind-derivation`).

`05`'s premise — "derive ourselves because it's configuration-free" — is wrong
on its own terms. An honest derivation needs heel, a per-boat leeway
coefficient, a mast height and a per-boat upwash table. Without them it can only
reproduce the instrument's answer on boats where the instrument is itself naive,
so it can only lose.

Three findings carry the verdict:

1. **`MWV,R` is not necessarily a measurement.** On an H5000 system the
   transmitted AWA/AWS are "back-calculated from the True Wind data so as to
   include True Wind Correction data" (H5000 OM p.79); the raw masthead values
   live under separate names with **no NMEA 0183 sentence at all**. Deriving
   true from apparent can therefore mean inverting the instrument's own
   arithmetic with a different boat-speed value and no corrections.
2. **The corrections are gated on hardware the 0183 stream doesn't identify.**
   The Triton2 manual states three times that the TWA table, TWS table and
   Motion (heel) correction are "only available if an H5000 CPU is connected".
   The Zeus 3 manual has no wind-calibration section at all. So `MWV,T` is
   either naive trig (nothing to win by re-deriving) or richly corrected (we'd
   be strictly worse) — and we cannot tell which from the wire.
3. **Self-consistency.** SailPlan builds *and* queries the polar with the same
   instrument, so stable bias largely cancels. What doesn't cancel is bias
   varying across the polar domain, between tacks, or in time — which is
   exactly why the answer is "cross-check only", not "derive as fallback".

### What matters at 1 kn / 4° resolution

| Correction | TWA error | TWS error | Reproducible? |
| --- | --- | --- | --- |
| **Upwash** | **3–5°/tack** (6–10° tack-to-tack) — a full bin | negligible | **No** — needs a sailed calibration table |
| **B&G downwind TWS table** | — | **~10 %, TWA-dependent** (1.2 kn at TWS 12); B&G's *shipped default* is −10 % | **No** — proprietary, on the CPU |
| **Wind gradient** (mast height vs ORC's 10 m) | — | +2.4 % (12 m) to +9.1 % (20 m) | Only with mast height — and correcting it alone makes things worse |
| **Heel** | +1.8° @ 20°, +2.8° @ 25° | +2.7–4.4 % upwind, up to +10 % reaching | Yes — `XDR` heel is free at 1 Hz |
| **Leeway** (`k·heel/BSP²`) | −1.6° at 4° leeway | −2.5 % upwind, −4.4 % reaching | Only with a per-boat `k` |
| **Boat-speed calibration** (6 %) | 1.2–1.9° | ~0.3 kn | No — that is the map's open calibration fog |

Sensitivities worth internalising: `dTWA/dAWA` is **1.3–1.5 upwind**,
`dTWS/dAWS ≈ 0.84–0.98`, and `dTWA/dBSP` is **2–5 °/kn** — boat-speed
calibration error leaks into *both* wind axes.

Corroboration held: the computed +2.79° TWA at 25° heel sits on NKE's published
"~2.5°", and the upwash propagation reproduces Ockam's "0.3° of Cal Upwash per
degree of tack-to-tack TWD" worksheet rule.

### The cross-check still earns its build

~150 lines, no hardware: derive TW twice — once from `VHW`+`HDG`, once from
`VTG`/`RMC` — and see which `MWV,T` tracks. It is the only way to answer `01`'s
open verify item 7 (water- vs ground-referenced) without a tide table, and a
TWA-dependent ~−10 % TWS offset downwind is the diagnostic signature of an
H5000-corrected stream. Output is a **per-session classification**, not a
per-sample column (`05` §6).

### Consequences elsewhere

- **`03`'s "never pool sources" gains a physical reason**, not just a
  statistical one: a captured polar sits on a masthead-height,
  instrument-corrected TWS scale; an imported ORC/designer polar on a 10 m
  free-stream scale. They differ **5–9 % in TWS and 3–5° in TWA** before any
  calibration error. They were never the same axis.
- **`05`** stores `heel`/`trim` and keeps `awa`/`aws` as columns; the
  derivation becomes a session classification.
- **The map's calibration fog is now sized** — the largest unmodelled term is
  upwash at 3–5° TWA (a full bin), and it is not something the app can fix.
- **Light-air captures (below ~6 kn TWS) should be low-confidence** on
  wind-shear grounds alone.
- **`04` gains 8 verify items**, ported onto that ticket.

### Could not establish

- Whether the Zeus 3 **preserves** an H5000's corrections through 0183
  re-encoding, or recomputes.
- Whether the Zeus 3 computes true wind itself when nothing else on the bus
  does (still open from `01`).
- **Whether B&G folds leeway into transmitted TWA** (track-relative, as
  Expedition does) or keeps it heading-relative — worth up to ~4°, a full bin.
- Which N2K wind reference (3 = boat-referenced vs 4 = water-referenced) Navico
  maps onto `MWV`'s `T` flag.
- Any published quantitative error budget for an uncalibrated B&G system.
- B&G's exact heel-correction formula — the `atan(tan(AWA)/cos(heel))` form
  used is standard published geometry, not B&G's stated one.
- **Weakest numbers in the document:** the AWS heel under-read model
  (`sqrt(cos²a + sin²a·cos²heel)`) is the researcher's own — no primary source
  gives an anemometer speed formula, so the 6–13 % beam-reach figures are
  order-of-magnitude only and are flagged as such.
