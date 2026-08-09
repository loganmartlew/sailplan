# 17 — How is true wind actually derived, properly?

Research answer for [issues/17-true-wind-derivation.md](../issues/17-true-wind-derivation.md).
Builds directly on [research/01](01-zeus-3-nmea-output.md).

## Summary / verdict

**Trust `MWV,T`; derive independently as a cross-check only — never as the
polar's source of truth.** The naive vector subtraction that `05` proposed is
*not* configuration-free: done honestly it needs heel, a per-boat leeway
coefficient, a per-boat upwash table and a mast height, and done naively it
reproduces the instrument's own answer only on the boats where the instrument
is itself naive. On the boats where the instrument is *better* than naive
(anything with an H5000 CPU), the inputs to its corrections never reach the
0183 stream, so a home-grown derivation is strictly worse.

Three findings carry the decision:

1. **B&G's `MWV,R` is not necessarily a raw measurement.** On an H5000 system
   the AWA/AWS *functions* are explicitly "back-calculated from the True Wind
   data so as to include True Wind Correction data"; the raw masthead values
   live under separate names (`MWA`/`MWS`) that never reach NMEA 0183. So
   "derive true from apparent" can be a round-trip through corrections we
   cannot see, re-done with different boat-speed and damping assumptions.
2. **The two corrections that matter most at polar resolution are the two we
   cannot reproduce** — upwash (3–5° of TWA per tack upwind) and B&G's
   TWA-dependent TWS correction table (**−10 % is the shipped default**). Both
   are per-boat calibration data living on an H5000 CPU. Neither is derivable
   from `MWV,R` + `VHW` + `HDG`.
3. **The self-consistency argument.** SailPlan both *builds* and *queries* the
   polar with the same instrument. A stable bias in TWA/TWS therefore largely
   cancels; what does not cancel is bias that **varies across the polar domain**
   (upwind vs downwind), **varies between tacks**, or **varies in time** (tide
   leaking in via a ground-referenced frame). Optimising for absolute accuracy
   is the wrong target; optimising for *stability and detectability* is the
   right one — and that argues for one consistent source, not two blended.

### The short version

| Question | Answer | Confidence |
| --- | --- | --- |
| **Verdict** | **Trust `MWV,T` for polar TWA/TWS. Derive in parallel as a cross-check that classifies the stream, never as the value written to a polar point.** | High — follows from the rows below |
| The textbook math | Plain 2-D vector subtraction of the boat's velocity-through-water from the apparent wind vector. `TWx = AWS·cos(AWA) − BSP`, `TWy = AWS·sin(AWA)`, `TWA = atan2(TWy,TWx)`, `TWS = hypot(TWx,TWy)`, `TWD = HDG_true + TWA`. Identical in ORC's VPP (eqs 7.2/7.3, inverted), Signal K, and OpenCPN Tactics. | High — primary (ORC VPP 2023 §7.1; Signal K source) |
| Is the naive version *correct*? | It is exactly correct **given** correct inputs and a boat with no leeway, no heel and a sensor in undisturbed flow at the reference height. Every real correction is about the inputs, not the trigonometry. | High |
| Biggest correction at polar resolution | **Upwash** — 3–5° of TWA error per tack upwind, i.e. **≈ one full 4° bin**, showing up as 6–10° of "true wind tacking". | High — three independent primary/vendor sources agree on 3–5°/tack |
| Second biggest | **B&G's TWS correction table, default −10 %** applied downwind for masthead over-read. At 12 kn that is 1.2 kn — **more than one 1 kn bin**, and it is *TWA-dependent*, so it tilts the polar rather than shifting it. | High — primary (H5000 + Triton2 manuals both state the −10 % default) |
| Heel | At 20° heel: **+1.8° TWA and +2.7 % TWS** upwind; at 25°: **+2.8° TWA, +4.4 % TWS**; on a beam reach at 25° heel the TWS error reaches **+10 %**. Needs heel angle (Zeus 3 emits it via `XDR` at 1 Hz). | Med-high — my computation from the published heel formula; NKE independently states "25° heel ⇒ ~2.5° error on TWA", which matches |
| Leeway | Ignoring 4° of leeway costs **−1.6° TWA and −2.5 % TWS** upwind, ~−4 % TWS on a reach. `Leeway = k·heel/BSP²` with k ≈ 7–16, per-boat. B&G, Ockam and Expedition all use the same equation. | High for the formula (Expedition + Ockam + Signal K + OpenCPN all quote it); high for magnitudes (my computation) |
| Wind gradient / sensor height | Masthead TWS runs **+2.4 % at 12 m to +9.1 % at 20 m** above the ORC polar reference height of 10 m (ORC log profile, z₀ = 0.005 m). **0.3–1.6 kn — at or above the 1 kn bin.** Nobody in the Zeus 3 chain corrects it. | High — primary (ORC VPP 2023 eq. 7.1); arithmetic mine |
| Mast rotation | Only on rotating rigs; corrected upstream by the Zeus 3 ("Use mast rotation") or the H5000, invisible in the 0183 stream. Not applicable to a conventional rig. | High — primary (Zeus3 IM p. 24) |
| Sensor lag / damping | B&G damps heading, apparent wind, true wind, TWD, boat speed, SOG and COG **independently, 0–9 s each**, plus "Dynamic Damping". Deriving from differently-lagged 1 Hz inputs is only a transient problem; irrelevant to steady-state promotion. | High — primary (H5000 OM p. 34) |
| **Which corrections a Navico system applies before `MWV,T`** | **Depends entirely on what else is on the bus, and the app cannot tell from the stream.** Zeus 3 alone: *no wind calibration whatsoever*. Triton2: MHU alignment + mast rotation only. **TWA table, TWS table and Motion (heel) correction are explicitly "only available if an H5000 CPU is connected."** | High — primary (Triton2 OM p. 63–64 states the H5000 gating three times; Zeus3 IM has no wind-calibration section at all) |
| Water- vs ground-referenced | B&G *defines* TWS as "the speed of the wind measured relative to the water surface" — water-referenced by design. But **"Use SOG as boat speed"** and **"Use COG as heading"** are one-tick settings that silently make it ground-referenced, and are commonly enabled to stop TWD wandering. NMEA 0183 still cannot say which. | High that the default is water-referenced; high that the setting exists; **the boat's actual state is unknowable from documents** |
| Is the frame knowable from the stream? | **Yes, empirically, by the cross-check.** Derive TW twice — once from `VHW`+`HDG`, once from `VTG`/`RMC` — and see which one `MWV,T` tracks. If it tracks the ground version, the polar is tide-contaminated. This is the single best reason to build the cross-check. | Med-high — sound in principle, unvalidated on real data; needs a tideway to be decisive |
| Does deriving ourselves help? | **No.** On a naive boat we reproduce the instrument (no gain, new failure modes). On a corrected boat we produce something worse and inconsistent with what the crew saw on deck. | High |

### What this changes for the map

- **Founding decision / `05`:** `05`'s premise — "derive ourselves because it
  works on any boat with no per-boat configuration" — is **wrong on its own
  terms**. Honest derivation needs a leeway coefficient, a mast height, and an
  upwash table, all per-boat. `01`'s recommendation ("derive polars from
  `MWV,T`, keep `MWV,R` in the raw log") stands and is now justified with
  numbers rather than convenience.
- **New work for `05`:** the cross-check is small and worth specifying — parse
  `MWV,R`, `VHW`, `HDG`, `VTG`/`RMC` and `XDR`, derive both frames, and store a
  per-session **classification** (water / ground / instrument-corrected /
  unknown) rather than a per-sample derived TWA. It costs one more sentence
  parser and no new hardware.
- **Reinforces `03`'s "never pool sources".** There is now a *physical* reason
  and not just a statistical one: a captured polar is on a **masthead-height,
  instrument-corrected TWS scale**, while an imported ORC/designer polar is on a
  **10 m free-stream scale**. Those differ by 5–9 % in TWS and by 3–5° in TWA
  before any calibration error. They are not the same axis, and pooling them
  was never comparing like with like.
- **`04`'s verify list gains sharper items** — see §7.
- **`map.md` → "Instrument calibration" fog is now sized.** The single largest
  unmodelled term is upwash at 3–5° of TWA (one full bin), and it is *not*
  something the app can fix; it is something the boat's H5000 (if any) fixes
  with a calibration the owner has to sail for.

---

## 1. The textbook vector math, and its traps

### The formulation

Work in a boat-fixed 2-D frame: **x forward along the bow, y to starboard**,
angles measured from the bow, positive to starboard. Then, with `AWS`/`AWA` the
apparent wind and `V_boat` the boat's velocity **through the water**:

```
TWx = AWS·cos(AWA) − V_boat_x
TWy = AWS·sin(AWA) − V_boat_y
TWA = atan2(TWy, TWx)                 # −180 … +180, sign = tack
TWS = sqrt(TWx² + TWy²)
TWD = normalise(HDG_true + TWA)       # compass direction wind is FROM
```

For the naive case `V_boat = (BSP, 0)` this collapses to
`TWx = AWS·cos(AWA) − BSP`, `TWy = AWS·sin(AWA)`.

This is the same relation ORC's VPP states in the forward direction — given
true wind and boat speed, produce apparent:

> ```
> βA = tan⁻¹( VT·sin βT·cos φ / (VT·cos βT + Vs) )
> VA = sqrt( (VT·sin βT·cos φ)² + (VT·cos βT + Vs)² )
> ```
>
> — *ORC VPP Documentation 2023*, eqs. 7.2 and 7.3

(ORC's `cos φ` on the cross-track term is the heel factor — see §2.1. The VPP
applies it because the sails live in the heeled plane; a masthead sensor
experiences the mirror-image of the same geometry.)

Signal K's implementation is the same code in JavaScript
(`src/calcs/windGround.ts`), differing only in that it subtracts SOG and so
produces *ground* wind:

```js
const apparentX = Math.cos(awa) * aws
const apparentY = Math.sin(awa) * aws
const gx = apparentX - sog
angle = Math.atan2(apparentY, gx)
speed = Math.sqrt(apparentY * apparentY + gx * gx)
dir   = formatCompassAngle(headTrue + angle)
```

Note what Signal K's *file name* is telling you: the identical formula fed STW
gives water wind and fed SOG gives ground wind. **The formula does not know
which one it computed.** That is the whole reference-frame problem in one line.

### The sign and convention traps

Ordered by how likely each is to be shipped as a bug.

1. **`MWV` angle is 0–359°, not ±180°.** `01` already flagged the fold to
   SailPlan's 0–180-plus-tack convention. The trap for *derivation* is
   different: you must convert to a **signed** angle **before** the vector math
   (`awa_signed = awa > 180 ? awa − 360 : awa`), because `atan2` needs a signed
   y-component. Folding to 0–180 first destroys the tack and the trig silently
   produces a mirror-image answer.
2. **`atan2(y, x)`, not `atan(y/x)`.** Downwind `TWx` goes negative
   (`AWS·cos(AWA) < BSP` is routine at TWA > 90°); `atan` collapses the two
   quadrants onto one and returns a TWA that is 180° wrong. This is exactly the
   bug `12` found in NMEASimulator.
3. **`AWS·cos(AWA) − BSP` can be negative *and* small.** Sailing dead downwind
   faster than the wind (rare on a keelboat, routine on a foiler) flips the sign
   of TWA. Guard, don't assume.
4. **TWA is relative to *what*.** Expedition and some instrument systems make
   TWA relative to the boat's **track through the water** (heading + leeway);
   B&G keeps TWA relative to **heading** and exposes track separately as
   "Course = Heading + Leeway". A polar built on one convention and queried on
   the other is wrong by the leeway angle, ~2–6° upwind — potentially a whole
   bin. Whichever you pick, pick it once and write it down.
   > "Expedition and some instrument systems include leeway in Twa (so twa is
   > relative to the boat's track through the water instead of its heading)."
   > — *Expedition help*, "Leeway"
5. **`HDG` is magnetic; `MWD` is available in both true and magnetic.** `01`
   already established `HDT` is receive-only on this platform. Deriving TWD
   means `HDG` + variation, and mixing a magnetic heading with a true-referenced
   TWD is a silent ~10–20° error depending on where you sail.
6. **Talker-ID blindness.** `MWV` is emitted twice per second with different
   reference flags. Branch on field 2, never on the sentence type (`01` flagged
   this; it bites derivation harder because you need *both*).
7. **Units.** `MWV` field 4 is `K`/`M`/`N` and the standard permits any of them.
   `MWD` carries speed twice in two units. Don't assume knots.

---

## 2. What real systems correct beyond the naive subtraction

Every correction below is a correction to the **inputs**, not to the
trigonometry. Magnitudes marked "computed" are my arithmetic on the published
formula, run over representative polar points for a ~35 ft cruiser-racer; the
script is reproducible from the formulas quoted here.

### 2.1 Heel / mast tilt — 1.8° TWA and 2.7 % TWS at 20° heel

**The correction.** A masthead unit tilts with the mast. The vane measures the
wind's direction *projected into the tilted plane*, and the cups respond only to
the in-plane component of the wind, so a heeled sensor reads the angle too
narrow upwind and the speed too low everywhere. The published correction to the
measured angle is

```
AWA_horizontal = atan( tan(AWA_measured) / cos(heel) )
```

NKE describes the speed half of the same effect in plain language:

> "When the boat heels, the wind flow is no longer perpendicular to the
> anemometer and the rotor is slowed down due to less pressure on the cups,
> causing the wind speed to read lower values than it should. Heel angle data
> allows a correction factor to be applied. **A 25° heel angle generates
> approximately a 2.5° error on true wind angle value.**"
> — *nke Marine Electronics*, Regatta Processor

**Magnitudes (computed).** Angle error introduced at the sensor:

| AWA measured | heel 10° | heel 20° | heel 25° | heel 30° |
| --- | --- | --- | --- | --- |
| 25° | +0.34° | +1.39° | +2.23° | +3.30° |
| 30° | +0.38° | +1.57° | +2.50° | +3.69° |
| 45° | +0.44° | +1.78° | +2.81° | +4.11° |
| 90° | 0° | 0° | 0° | 0° |
| 140° | −0.43° | −1.76° | −2.79° | −4.10° |

AWS under-read at the same heels: 0.3 % / 1.2 % / 1.9 % / 2.9 % at AWA 25°,
rising to **1.5 % / 6.0 % / 9.4 % / 13.4 % at AWA 90°** (the beam-on case,
where the whole wind vector is across the tilted plane).

Propagated through the wind triangle:

| Point | heel 10° | heel 20° | heel 25° |
| --- | --- | --- | --- |
| beat TWA 40 / TWS 12 | +0.43° TWA, +0.6 % TWS | +1.76°, +2.7 % | +2.79°, +4.4 % |
| beat TWA 42 / TWS 8 | +0.44°, +0.7 % | +1.78°, +2.9 % | +2.81°, +4.8 % |
| reach TWA 90 / TWS 12 | 0°, +1.5 % | 0°, **+6.4 %** | 0°, **+10.3 %** |
| run TWA 140 / TWS 12 | −0.43°, +0.6 % | −1.76°, +2.7 % | −2.79°, +4.4 % |

My +2.79° at 25° heel upwind sits right on NKE's published "~2.5°", which is
the best independent check available.

**Does it matter at 4°/1 kn?** Upwind, yes at 20°+ heel: it is half a TWA bin
and a third of a TWS bin, and — critically — **heel correlates with TWS**, so
the error is not a constant offset, it is a *tilt of the polar*. On a reach it
is the largest single TWS error in this document apart from the −10 % table.

**Inputs needed.** Heel angle. The Zeus 3 emits it at 1 Hz via `XDR`
(`$IIXDR,A,2.5,D,HEEL,...` — `01` §3(a)), so this correction is one of the few
we *could* apply.

**Who applies it.** B&G: only with an H5000 CPU. The Triton2 manual is explicit
that "Motion" correction "is only available if an H5000 CPU is connected" and
additionally requires a 3D motion sensor, a mast-height value and "Hercules
level software or greater". The H5000 manual likewise says heel is "used by
**Hercules** systems to correct wind data for the change of orientation of the
sensor in the airflow", and lists "Heel correction On/Off" as an AWA
calibration. Ockam applies it as a matter of course ("Heel angle … is used to
correct the true wind readings"). **The Zeus 3 on its own does not.**

### 2.2 Upwash / masthead flow deflection — 3–5° of TWA, the biggest term

**The correction.** The sails bend the airflow before it reaches them, and the
masthead sits inside that disturbed flow. Ockam's manual is the clearest
statement of the physics and of why it is unavoidable:

> "The wind is bent by the sails as it approaches them. In fact, the drive
> created by the sails is caused by this bending. However, if the masthead is
> inside this disturbed flow, it is not reading the proper angle and speed.
> This effect is termed upwash…"
> — *Ockam System Manual* (2009), "CAL Upwash"

**Magnitude.** Three independent sources converge on **3–5° per tack**:

- Sailmon: "If the TWD would be north, your instruments will probably show a
  value of 3-5° for the TWD" on one tack and "355°–357°" on the other — i.e.
  **6–10° of true-wind tacking**.
- Ockam ships a default `CAL Upwash` of **−3.0°** with a slope of
  **+0.300 °/kn** about 12 kn TWS, and its worked calibration example corrects a
  **10° tack-to-tack TWD split**.
- Ockam's calibration qualification sets expectations: a first session gets you
  to a **5–7° tack-to-tack solution**; sustained effort gets to **3°**.

Ockam's full functional form, which is the most explicit published upwash model
I found:

```
Upwash = [ K_upwash + K_slope·(min(Vt,35) − 12) ]
         · sign(Ba) · sin^2.5( 0.6·(180 − Ba) ) · Reef² · Flat
```

Evaluated at Ockam's shipped defaults (K = −3.0, slope = 0.30), the correction
applied to AWA is −4.2° at 8 kn TWS, −3.0° at 12 kn, −1.2° at 18 kn while
close-hauled; the `sin^2.5` shape decays it to −1.8° at AWA 90° and −0.2° at
AWA 150°. Note that it is **strongly TWS-dependent** — it does not survive being
approximated by a constant.

**How that lands on TWA.** Computed sensitivity `dTWA/dAWA` is **1.29–1.50**
close-hauled, falling to 1.00 at AWA 58° and 0.57 downwind. So a 3° upwash
error in AWA becomes **~4.3° of TWA** upwind — and, because TWD = HDG + TWA, it
becomes **~8.6° of tack-to-tack TWD split**, which is where Ockam's "apparent
wind angle has a 3:1 effect on true wind angle" rule of thumb and its "0.3° of
Cal Upwash per degree of tack-to-tack TWD change" worksheet both come from.

**Does it matter at 4°/1 kn?** **Yes — this is the term that matters most.**
4.3° of TWA is a full bin. It has "no significant effect on true wind speed"
(Ockam), so it is purely a TWA-binning error.

**Inputs needed.** A per-boat, per-TWS, per-sail-set calibration table obtained
by sailing tack-to-tack for 30–45 minutes in steady breeze. **This is not
derivable from the stream.** Expedition, Sailmon, Ockam and B&G all solve it
the same way — a table populated by a physical calibration session — precisely
because it cannot be computed.

**Who applies it.** B&G: the **TWA correction table**, "only available if an
H5000 CPU is connected". Not the Zeus 3, not a Triton2 alone.

### 2.3 The downwind TWS over-read — B&G's −10 % default

Distinct from upwash-on-angle and quantitatively larger for polars. Both B&G
manuals say the same thing verbatim:

> "True Wind Speed errors are seen from sailing upwind to downwind. This is due
> to the acceleration of the airflow over the top of the mast and around the
> sails when sailing downwind. **-10% is the default value** for TWA
> calibration."
> — *H5000 Operation Manual* p. 54; identically in *Triton2 Operator Manual* p. 64

Expedition describes B&G's mechanism from the outside:

> "In general, the wind sensor will read more wind downwind than upwind because
> of upwash… B&G instruments have a simple, but effective solution in which the
> difference is entered in a calibration table and subtracted downwind. Less is
> subtracted as TWA decreases."
> — *Expedition help*, "True wind speed"

**Magnitude.** 10 % of 12 kn is **1.2 kn — more than one full TWS bin.** And it
is *TWA-dependent*: the same physical breeze is reported ~10 % lower at TWA 150°
than at TWA 40°. That does not shift a polar, it **shears** it, moving downwind
points a bin left relative to upwind points.

**Consequence for this decision.** If the boat has an H5000, `MWV,T` carries
this correction and our derived TWS will not — so the two will disagree
systematically downwind and agree upwind. That signature is *diagnostic*: it is
how the cross-check can detect that the stream is instrument-corrected. It is
also why we must not silently substitute our own derived TWS: doing so would
un-apply a correction the boat's owner deliberately calibrated.

### 2.4 Leeway — −1.6° TWA and −2.5 % TWS at 4° of leeway

**The correction.** The boat's velocity through the water is not along its
heading. The wind triangle must subtract the *actual* velocity vector. Four
independent systems use literally the same equation:

```
Leeway = k · heel / BSP²
```

- Expedition: "Expedition uses the same equation as used by systems such as
  Ockam and B&G to estimate leeway… For many purposes a value of 7 or 8 will
  suffice."
- Ockam: `LEEWAY = (CAL LEEWAY)·HEEL / BOATSPEED²`, factory default 0 (i.e.
  disabled until calibrated), initial-setup value 8.0.
- Signal K (`src/calcs/leeway.ts`): k default 12, described as "typically from 9
  to 16 (9 for super racer)", citing Arvel Gentry's *Sailboat Performance
  Testing Techniques*.
- OpenCPN Tactics: "Leeway = hullshape-factor*heel/(STW*STW)", factor 0–20,
  start at 10.

At k = 9–16, heel 20°, STW 6.4 kn that is **4.4°–7.8° of leeway**; at k = 12,
heel 10°, STW 6 kn it is 3.3°.

**Magnitude of ignoring it (computed, TWA quoted relative to heading in both
cases):**

| Point | leeway 2° | leeway 4° | leeway 6° |
| --- | --- | --- | --- |
| beat TWA 42 / TWS 8 | −1.00° TWA, −1.6 % TWS | −2.01°, −3.2 % | −3.01°, −4.9 % |
| beat TWA 40 / TWS 12 | −0.81°, −1.2 % | −1.63°, −2.5 % | −2.43°, −3.7 % |
| beat TWA 40 / TWS 18 | −0.58°, −0.9 % | −1.14°, −1.7 % | −1.70°, −2.7 % |
| reach TWA 70 / TWS 12 | −0.40°, −2.0 % | −0.77°, −4.0 % | −1.12°, −6.0 % |
| reach TWA 90 / TWS 12 | +0.02°, −2.2 % | +0.09°, **−4.4 %** | +0.21°, −6.5 % |
| run TWA 140 / TWS 12 | +0.89°, −1.2 % | +1.83°, −2.4 % | +2.81°, −3.5 % |

**Does it matter at 4°/1 kn?** Marginally on TWA (about half a bin upwind), more
on TWS (−0.3 to −0.5 kn, a third to a half bin, and worst on a reach). Like
heel, it is **not a constant offset**: leeway scales with heel/BSP², so it
varies systematically across the polar.

**Inputs needed.** Heel (`XDR`, available), STW (`VHW`, available), and a
per-boat `k` that is **not** obtainable from the stream — Expedition's advice is
to derive it from the designer's VPP.

**Who applies it.** B&G computes Leeway as a first-class variable and uses it
for Course and dead reckoning; Expedition states B&G uses the same equation for
the wind triangle. Whether B&G folds leeway into the transmitted TWA, or keeps
TWA heading-relative and exposes leeway only via Course, **I could not
establish** (see §8).

### 2.5 Wind gradient and sensor height — +2.4 % to +9.1 % TWS

**The correction.** Wind speed increases with height. Polars are defined at a
reference height; masthead sensors are not at that height. ORC's VPP is the
authority for what the reference *is*, since it is what published polars are
built against:

> ```
> VTz = VTzref · log(z/z0) / log(zref/z0)
> where  zref = 10.0 m, reference height for VT measurements
>        z0   = 0.005 m
> ```
> — *ORC VPP Documentation 2023*, eq. 7.1

**Magnitude (computed from that formula):**

| Masthead height | V(z)/V(10 m) | at TWS₁₀ = 8 kn | 12 kn | 18 kn |
| --- | --- | --- | --- | --- |
| 12 m | 1.024 (+2.4 %) | 8.19 | 12.29 | 18.43 |
| 15 m | 1.053 (+5.3 %) | 8.43 | 12.64 | 18.96 |
| 17 m | 1.070 (+7.0 %) | 8.56 | 12.84 | 19.26 |
| 20 m | 1.091 (+9.1 %) | 8.73 | 13.09 | 19.64 |

**Does it matter at 4°/1 kn?** For **absolute** TWS, yes — 0.3 to 1.6 kn, at or
above one full bin. For a **self-consistent** polar, no: it is a near-constant
multiplicative factor that cancels when the same instrument builds and queries
the table. It matters exactly at the boundary `03` already drew: comparing or
blending a captured polar with an imported ORC/designer polar means comparing a
masthead-height scale against a 10 m scale.

**Who applies it.** Nobody in the Zeus 3 chain. Sailmon does it explicitly
("Sailmon uses mast height correction to display the 10m altitude wind even if
the mast sensor is mounted higher or lower"), as does ORCA. B&G's Motion
correction takes a mast-height value, but for motion, not gradient.

**Wind shear** is the angular sibling and is worse because it is
uncorrectable: it produces a TWA that genuinely differs tack to tack, is
strongest below ~6 kn TWS, and Sailmon's advice is simply *don't calibrate in
it*. For SailPlan the actionable version is: **light-air captures (below ~6 kn
TWS) are the least trustworthy polar data**, independent of everything else in
this document.

### 2.6 Mast rotation and twist

Only relevant to rotating rigs. The Zeus 3 has a "Use mast rotation" option for
wind that requires a mast rotation sensor, and explicitly instructs disabling it
when an H5000 is present because the CPU does it. Mast *twist* (the top of the
mast bending off relative to the deck) is real on a soft rig and is one of the
things Expedition's TWA table "collectively corrects for" alongside upwash — it
is not separable, and not derivable.

**Not applicable to a conventional keelboat rig.** Noted only so that a future
reader does not go looking for it in the stream: if it is happening, it happens
upstream and is invisible.

### 2.7 Sensor lag and damping

B&G exposes independent 0–9 s damping on **heading, apparent wind (angle and
speed), true wind, true wind direction, boat speed, dynamic boat speed, tide,
SOG and COG**, plus a "Dynamic Damping" mode on boat speed and TWD.

Two consequences:

- **Deriving from the stream mixes differently-lagged inputs.** If AWS is damped
  2 s and BSP 6 s, the derived TW is wrong during any transient. `MWV,T`, by
  contrast, is damped once, coherently, after the trig.
- **For polar promotion this barely matters**, because promotion selects
  steady-state stretches and takes a median over them (`14`'s harness). Lag is a
  manoeuvre problem, and manoeuvres are excluded by construction.

The one place it does matter: the **steady-state filter** in `07` should key off
values that share a damping regime. Mixing an undamped derived TWS with a damped
`MWV,T` would make the filter's stability test measure the damping, not the boat.

### 2.8 The sensitivity table, for calibrating intuition

`dOutput/dInput` at representative polar points, computed on the naive
triangle. This is the table that says which input errors matter:

| Point | AWA | AWS | dTWA/dAWA | dTWS/dAWA | dTWA/dAWS | dTWS/dAWS | dTWA/dBSP | dTWS/dBSP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beat TWA 42 / TWS 8 | 25.3° | 12.5 | **1.50** | 0.063 | −2.06 | 0.958 | **4.79** | −0.743 |
| beat TWA 40 / TWS 12 | 26.3° | 17.4 | 1.41 | 0.072 | −1.13 | 0.972 | 3.07 | −0.766 |
| beat TWA 40 / TWS 18 | 29.3° | 23.6 | 1.29 | 0.076 | −0.59 | 0.983 | 2.05 | −0.766 |
| reach TWA 90 / TWS 12 | 58.0° | 14.2 | 1.00 | 0.131 | −2.53 | 0.848 | 4.77 | 0.000 |
| run TWA 140 / TWS 12 | 107.2° | 8.1 | 0.57 | 0.076 | −2.58 | 0.841 | 3.07 | 0.766 |
| run TWA 165 / TWS 18 | 154.8° | 10.9 | 0.60 | 0.034 | −0.57 | 0.984 | 0.82 | 0.966 |

*(units: deg/deg, kn/deg, deg/kn, kn/kn, deg/kn, kn/kn)*

Read three things off it:

1. **`dTWA/dBSP` is 2–5 °/kn.** A boat-speed calibration error of 6 % — the
   figure `03` already measured the polar cost of — is ~0.4 kn at 6.4 kn, which
   is **1.2–1.9° of TWA and ~0.3 kn of TWS**. Boat-speed calibration is not just
   a boat-speed problem; it leaks into both wind axes. This is the strongest
   quantitative link between this ticket and `map.md`'s calibration fog.
2. **`dTWS/dAWS ≈ 0.84–0.98.`** TWS error tracks AWS error almost 1:1. The
   masthead's own speed calibration (B&G default 1.04, "factory set based on
   wind-tunnel tested sample units") passes straight through.
3. **`dTWA/dAWA` is 1.3–1.5 upwind and 0.6 downwind.** Angle errors are
   amplified where the polar is most sensitive and damped where it is least.

---

## 3. What a Navico system actually applies before `MWV,T`

**This is the crux of the ticket, and the answer is that it depends on hardware
the 0183 stream does not identify.**

| Correction | Zeus 3 alone | + Triton2 | + H5000 CPU | + H5000 Hercules & 3D motion |
| --- | --- | --- | --- | --- |
| MHU alignment offset | ✗ | ✓ | ✓ | ✓ |
| Mast rotation | ✓ (own setting) | ✓ | ✓ (CPU does it) | ✓ |
| Boat speed % calibration | ✓ *(local to the MFD only)* | ✓ | ✓ | ✓ |
| TWA correction table (upwash/twist) | ✗ | **✗** | ✓ | ✓ |
| TWS correction table (−10 % default) | ✗ | **✗** | ✓ | ✓ |
| Heel / motion correction of measured wind | ✗ | **✗** | ✗ | ✓ |
| Leeway in the wind triangle | ✗ | ? | ✓ | ✓ |
| Damping | ✓ | ✓ | ✓ | ✓ |

The gating is stated flatly and repeatedly in the Triton2 manual — three
separate notes, one for each feature:

> "**Note:** This option is only available if an H5000 CPU is connected to the
> system." — against *True wind angle*, *True wind speed*, and *Motion*
> — *Triton2 Operator Manual*, pp. 63–64

and the Motion entry adds the full precondition:

> "A 3D Motion sensor and mast height value is required in conjunction with a
> CPU running Hercules level software or greater to use this feature. When the
> wind is measured it is initially corrected for masthead unit alignment offset
> and mast rotation."
> — *Triton2 Operator Manual*, p. 64

That last sentence is the baseline: **without an H5000, the only thing done to
the measured wind is the MHU offset and mast rotation, then naive trig.**

Corroborating from the other end, the **Zeus 3 Installation Manual contains no
wind-calibration section at all** — its entire calibration menu is water speed
percentage, water temperature, depth offset and sea/air/barometric offsets, and
those "will ONLY be applied locally to this unit" (p. 27). The Zeus 3 is a
plotter that consumes wind; it is not a wind processor.

### The finding that breaks the "derive from apparent" plan

On an H5000 system the apparent wind that leaves the CPU is **not the
measurement**:

> "Apparent Wind Angle (AWA) is the angle of the wind relative to the bow of the
> boat. **The value displayed is back-calculated from the True Wind data so as
> to include True Wind Correction data.** Raw wind angle data from the masthead
> unit is displayed as Measured Wind Angle."
> — *H5000 Operation Manual*, p. 79 (and identically for AWS)

> "Measured Wind Angle is the angle measured by the masthead unit, no
> calibrations are applied except the factory set offset… **Measured Wind is not
> used whilst sailing**, but is a useful function for checking the operation…"
> — *H5000 Operation Manual*, p. 98

And the direction of computation is stated outright:

> "True Wind Angle is calculated from Measured Wind Speed, Measured Wind Angle
> and Boat Speed, this data is then combined with True Wind correction and heel
> angle correction values to create True Wind data. **True Wind data is used to
> back-calculate Apparent Wind data**…"
> — *H5000 Operation Manual*, p. 99

So the pipeline is `MWA/MWS → (corrections) → TW → AWA/AWS`. On such a boat,
`MWV,R` is a *derived* quantity downstream of `MWV,T`. Re-deriving true wind
from it is not an independent measurement; it is inverting the instrument's own
arithmetic with a different boat-speed value and no corrections, and the result
is neither the raw truth nor the instrument's answer.

`MWA`/`MWS` — the actual measurements — have **no NMEA 0183 sentence** in the
Tier 1 set (`01` §3(a)). There is no path to the raw data over this transport.

### B&G's own definition of TWS settles the reference frame question, in principle

> "True Wind Speed (TWS) is the speed of the wind **measured relative to the
> water surface**."
> — *H5000 Operation Manual*, p. 100

…but two one-tick settings quietly convert it to ground-referenced:

> "**Use SOG as boat speed** — If boat speed is not available from a paddle
> wheel sensor it is possible to use speed over ground from a GPS. SOG will be
> used in the true wind calculations."
> — *H5000 OM* p. 51 and *Triton2 OM* p. 62

> "**Use COG as heading** — If heading data is not available from a compass
> sensor it is possible to use course over ground from a GPS. COG will be used
> in the true wind calculations."
> — *H5000 OM* p. 56

Both are commonly enabled — they are the standard fix when TWD wanders, and
community write-ups for the Zeus specifically recommend them for exactly that
reason. **If either is on, every polar point from that session has tidal current
baked into it, and nothing in the 0183 stream says so.**

---

## 4. Water- vs ground-referenced in practice

**NMEA 2000 distinguishes five wind references; NMEA 0183 has one bit.** From
canboat's decoding of PGN 130306 (`WIND_REFERENCE` lookup):

```
0  True (ground referenced to North)
1  Magnetic (ground referenced to Magnetic North)
2  Apparent
3  True (boat referenced)
4  True (water referenced)
```

`MWV`'s field 2 is `R` or `T`. Three distinct N2K "true" flavours collapse onto
one 0183 `T`, and the gateway does not record which one it started from. `01`
already identified this; the addition here is that **it is not merely
undocumented, it is not expressible** — no firmware revision could fix it
without changing the sentence.

### How systems that expose both choose

They don't choose; the *installer* chooses, by which sensor is nominated as the
boat-speed and heading source. Ockam states the intent plainly:

> "The true wind is the wind relative to the water; i.e. as if the boat were not
> moving."
> — *Ockam System Manual*, "True wind"

OpenCPN's Tactics plugin exposes the choice as a user preference and names both
motivations: "Use SOG instead of STW for True Wind Calc" as a fallback "when the
log fails **or to eliminate surface current side effects**". Signal K makes the
distinction structural — `environment.wind.angleTrueWater` vs
`angleTrueGround`, computed by the same code from different inputs.

### Is a boat's `MWV,T` frame knowable from the stream? Yes, by inference

Not from any field, but from a comparison. Derive true wind twice per sample:

- **W** = triangle(`MWV,R`, `VHW` speed, `HDG`+variation) — water-referenced
- **G** = triangle(`MWV,R`, `VTG`/`RMC` SOG, `VTG`/`RMC` COG) — ground-referenced

Then over a stretch:

| Observation | Conclusion |
| --- | --- |
| `MWV,T` ≈ W, and W ≉ G | Water-referenced. Good. Polar-usable. |
| `MWV,T` ≈ G, and W ≉ G | Ground-referenced — "Use SOG/COG" is on, or the true-wind producer is ground-referenced. **Tide is in the polar.** |
| W ≈ G | No usable current at the moment; test is inconclusive, retry elsewhere/later |
| `MWV,T` ≈ neither, with a **TWA-dependent TWS offset (~−10 % downwind)** | Instrument-corrected stream — an H5000 with populated correction tables. **Strongest possible reason to trust `MWV,T` and not our derivation.** |
| `MWV,T` ≈ neither, offset roughly constant | Something else is wrong: MHU offset, boat-speed calibration, `VHW` mis-scaled. Flag the session. |

The discriminating power depends on there being current: 1 kn of tide abeam at
TWS 12 moves TWD by several degrees and TWS by up to ~1 kn, which is well above
the noise floor of a median over a steady stretch. In slack water the test
returns "inconclusive", which is an honest answer and should be recorded as
such.

**This is the whole value of the derivation**, and it justifies building it
even though the answer to "should we derive?" is no.

---

## 5. What "good enough for polars" actually requires

SailPlan's bins are **1 kn TWS / 4° TWA**, and the grid is clustered and
median-based (`buildClusteredPolarGrid`). Two properties of that design change
the analysis:

- **Median binning is robust to noise but not to bias.** `03` already found this
  for boat speed ("calibration drift is not an outlier; it is a coherent offset
  the median moves along with"). The same holds on the wind axes.
- **TWA is folded to 0–180° plus tack.** So a *tack-antisymmetric* error (MHU
  misalignment: one tack reads wide, the other narrow) does not bias the bin —
  it **splits** the same physical state across two bins. With balanced tacks
  that widens the distribution; with unbalanced tacks (a long single-tack leg,
  which races produce constantly) it biases.

### Which corrections clear the bar

| Correction | TWA error | TWS error | ≥ 1 bin? | Reproducible by us? |
| --- | --- | --- | --- | --- |
| **Upwash** | 3–5°/tack (→ 6–10° tack-to-tack) | negligible | **Yes, TWA** | **No** — needs a sailed calibration table |
| **B&G −10 % downwind TWS table** | — | ~10 %, TWA-dependent | **Yes, TWS** | **No** — proprietary table on the CPU |
| **Wind gradient (mast height vs 10 m)** | — | +2.4 % to +9.1 % | **Yes for absolute TWS**; cancels for self-consistent use | Yes, *if* mast height is known — but only meaningful if we also un-do everything else |
| **Heel** | 1.8° @20°, 2.8° @25° | 2.7–4.4 % upwind, up to 10 % on a reach | **Borderline TWA; yes TWS on a reach** | Yes in principle (`XDR` heel) |
| **Leeway** | 0.8–2.4° | 1.2–4.4 % | Borderline | Only with a per-boat `k` |
| **Boat-speed calibration (6 %)** | 1.2–1.9° | ~0.3 kn | Borderline, both axes | No — that is `map.md`'s open fog |
| **MHU misalignment (3° typical)** | ±3–4.5°, antisymmetric | negligible | **Yes, as a split** | No — but the instrument already applies it |
| **Wind shear (light air)** | genuinely tack-dependent | — | Yes below ~6 kn TWS | No — nobody can |
| **Damping / lag** | transient only | transient only | No, given steady-state selection | n/a |
| **Sensor noise** | ±1–2° sample-to-sample | ±0.3 kn | No — median over a stretch kills it | n/a |

### The self-consistency argument, stated precisely

A polar point is `(TWS_bin, TWA_bin) → BSP`. Errors in TWA/TWS do not corrupt
the *measured boat speed*; they **mis-file** it. Later, the app queries the same
polar with TWA/TWS from the same instrument in the same conditions. If the
error is a stable function of the true state, the query lands in the same
mis-filed bin and returns the right boat speed. **A stable bias is nearly free.**

What is *not* free, in descending order of harm:

1. **Bias that varies across the polar domain** — the −10 % downwind TWS table
   and the TWS-dependence of upwash. These shear the table, so upwind and
   downwind sections are not on the same scale. Irreducible; we can only detect
   and record it.
2. **Bias that varies between sessions** — the owner re-calibrates, or switches
   "Use SOG as boat speed" on. Detectable by the cross-check; the mitigation
   already exists in `03`'s decision that sessions are separable and removable.
3. **Bias that varies in time within a session** — a ground-referenced frame in
   a turning tide. This is the one that most deserves to be caught, and the
   cross-check catches it.
4. **Tack asymmetry** — smears bins. Cheap to *measure* (compare port and
   starboard TWA distributions in the same TWS band) even though we cannot fix
   it.

**Crucially, mixing sources defeats self-consistency.** Writing `MWV,T` for some
points and our derivation for others — or blending them — produces a table with
two different wind scales in it. That is the worst available outcome and is the
concrete reason the verdict is "cross-check only", not "derive as a fallback".

---

## 6. Recommendation

**Trust `MWV,T`. Derive as a cross-check. Never blend.**

Concretely, for `05`/`07`:

1. **Polar TWA/TWS come from `MWV,T`, always.** Fold 0–359° to SailPlan's
   0–180-plus-tack convention. Take TWS from the same sentence.
2. **Parse `MWV,R`, `VHW`, `HDG`, `VTG`/`RMC` and `XDR` too.** They are already
   in the raw log (founding decision 2); the marginal cost is parsers.
3. **Run the dual derivation as a session-level classifier, not a per-sample
   value.** Over each promotable stretch compute median W, median G and median
   `MWV,T`, and store a small verdict record: `{ frame: water | ground |
   inconclusive, instrumentCorrected: bool, twsOffsetUpwind, twsOffsetDownwind,
   twaOffset, tackAsymmetry }`.
4. **Surface it in the review UI as a session-quality badge**, and make
   `frame: ground` a reason to warn before promotion (per `map.md`, a
   ground-referenced polar bakes tide into every point).
5. **Never write a derived TWA/TWS to a polar point**, and never fall back to
   derivation when `MWV,T` is absent. If `MWV,T` is missing, the honest outcome
   is "this session cannot produce polar points" — because a derivation without
   upwash and without the boat's TWS table is a *different instrument*, and
   mixing it into the same table breaks self-consistency for every point.
   (`01`'s verify item 4 exists precisely to find out whether this case is
   real. If the boat turns out to emit only `MWV,R`, that is a bigger decision
   than this ticket and should get its own.)
6. **Record `MWD` alongside** and cross-check its TWS against `MWV,T`'s. `01`
   already noted disagreement would be informative; this research says what it
   would mean — most likely two different producers on the bus with different
   correction states, which `01` §1 warns is possible via source selection.
7. **Do not attempt a gradient correction to 10 m.** It would put captured
   polars on the ORC scale while leaving every other error uncorrected, which is
   worse than being coherently on the masthead scale. Record the mast height if
   the owner knows it, so a future ticket *could*.
8. **Treat captures below ~6 kn TWS as low-confidence**, on shear grounds
   alone. This is independent of everything else here and is cheap to implement
   as a promotion filter.

### Why not "derive ourselves", restated in one paragraph

Because the two things that would make our derivation *better* than the
instrument's — upwash and the TWS table — are unobtainable, and the one thing
that would make it *different* — using our own choice of boat speed — is not an
improvement but a second, unvalidated calibration path. On a Zeus-3-only or
Triton2-only boat our answer converges on the instrument's (both are naive
trig on the same inputs) so there is nothing to win. On an H5000 boat our answer
is measurably worse and, worse still, disagrees with what the crew read on deck
during the race being reviewed. The asymmetry is one-sided: derivation can only
lose.

### Why the cross-check is still worth building

It is ~150 lines, needs no hardware, and it is the **only** way to answer
`01`'s open verify item 7 (water- or ground-referenced?) without a tide table
and a stopwatch. It also converts two of `map.md`'s open risks — reference
frame and calibration drift — from fog into a measurable per-session number,
which is exactly the shape `03` established for provenance: the useful thing is
being able to take a bad session back out, and that requires knowing which
sessions were bad.

---

## 7. Additions to the verify-on-boat list (`04`)

Beyond `01`'s list, and derived from this research:

1. **What computes true wind on this boat?** *Settings → Network → Sources* →
   the wind source. This determines everything in §3's table. If the answer is
   an H5000 CPU, `MWV,T` is corrected and derivation is off the table
   permanently. If it is a Triton2 or the MFD, `MWV,T` is naive trig and the
   cross-check should agree with it closely — which is itself a useful
   validation of our parser.
2. **Are "Use SOG as boat speed" and "Use COG as heading" enabled?** Photograph
   both settings. They are the difference between a usable polar and one with
   tide in it, and they live in different menus (boat speed vs compass).
3. **If an H5000 is present: are the TWA and TWS correction tables populated, or
   still at defaults?** A table of zeros means the corrections nominally exist
   but do nothing. The −10 % TWS default in particular — is it there?
4. **What are the damping values** for apparent wind, true wind, boat speed and
   heading? Needed to interpret any cross-check disagreement, and to size `07`'s
   steady-state window sensibly.
5. **Mast height (masthead unit above waterline).** One tape measure, one
   number, and it makes the gradient question answerable later without another
   trip.
6. **Is `XDR` heel actually populated**, and does it look sane (zero at the dock,
   signed correctly to starboard)? `01` listed `XDR` as a bonus; this research
   makes it the input to two of the three reproducible corrections.
7. **Sail a tack-to-tack pair in steady breeze and record `MWV,T` TWD on each
   tack.** The tack-to-tack split *is* the calibration state of the whole wind
   system in one number: 3° is well calibrated, 5–7° is a first-pass
   calibration, 10° is uncalibrated. It costs five minutes and it sizes every
   TWA error in this document for *this boat*.
8. **A run with known tide** — the practical discriminator for §4's table.

---

## 8. What could not be established

- **Whether the Zeus 3's `MWV,T` carries the H5000's corrections when an H5000
  is present.** It should — the MFD is relaying the bus value, and the H5000 is
  the true-wind producer — but no document states that the 0183 re-encoding
  preserves the corrected value rather than recomputing. `01` §1 established the
  gateway picks one source per data type; it does not say whether it ever
  *derives*.
- **Whether the Zeus 3 computes true wind itself when nothing else on the bus
  does.** The Zeus 3 manual's rotating-mast section refers to "the apparent and
  **calculated** wind", implying it can, but there is no documented wind-triangle
  section, no boat-speed-source setting for it, and no calibration for it. Left
  open in `01`; still open.
- **Whether B&G folds leeway into the transmitted TWA** (making TWA
  track-relative, as Expedition does) **or keeps TWA heading-relative** and
  exposes leeway only via the separate "Course" variable. The H5000 manual
  defines Course = Heading + Leeway as a distinct variable, which weakly implies
  TWA stays heading-relative, but I found no statement either way. This is worth
  up to ~4° of TWA — a full bin — and is directly measurable by the cross-check
  once `XDR` heel is in hand.
- **Whether the H5000's "back-calculated AWA/AWS" applies to the transmitted
  NMEA 2000 apparent-wind PGN, or only to the displayed value.** The manual
  describes the *function*, and functions are what get broadcast, but it does not
  say so explicitly. If it applies only to the display, then `MWV,R` on an H5000
  boat is closer to raw than §3 assumes — which would strengthen the case for a
  derivation, though not enough to change the verdict (upwash and the TWS table
  remain unreachable either way).
- **Which NMEA 2000 wind reference (3 = boat-referenced, 4 = water-referenced)
  Navico maps onto `MWV`'s `T` flag,** and whether it would emit two `MWV,T`
  sentences if both were on the bus. `01` flagged this; nothing found since.
- **Any published quantitative error budget for an uncalibrated B&G system.**
  The 3–5°/tack upwash figure comes from Sailmon and ORCA (competitors describing
  the general problem) and from Ockam's default calibration values, not from
  B&G. B&G publishes the −10 % TWS default and nothing else numeric.
- **The exact form of B&G's heel correction.** The H5000 manual confirms it
  exists ("Heel correction On/Off"), that Hercules-level software applies it, and
  that a mast height is required — but not the formula. The
  `atan(tan(AWA)/cos(heel))` form used in §2.1 is the standard published
  geometric correction, not B&G's stated one.
- **Whether the AWS heel under-read follows my `sqrt(cos²a + sin²a·cos²heel)`
  in-plane-component model.** No primary source gives an anemometer speed
  formula. The model is physically motivated and agrees in sign and rough size
  with NKE's description, but the 6–13 % beam-reach figures are the least
  supported numbers in this document. Treat them as order-of-magnitude.
- **Where Signal K's *water*-referenced true wind now lives.** The
  `signalk-derived-data` repository no longer contains a `trueWind` calculator —
  only `windGround`, `windDirection`, `leeway` and `leewayAngle`. The README
  still advertises "True Wind Angle, Direction and Speed (based on speed through
  water, AWA and AWS)". I could not locate the current implementation, so the
  Signal K citation in §1 is for the ground-wind form only. (The formula is
  identical modulo which speed is subtracted, so nothing rests on this.)
- **Real numbers for this boat.** Everything here is documented behaviour plus
  arithmetic. Per the map's boat-access constraint that is the correct place to
  stop, but every magnitude in §5's table is a *class* estimate, not a
  measurement of the boat SailPlan will actually record.

---

## Sources

### Primary — instrument manufacturers

- **B&G H5000 Operation Manual** (Navico, 109 pp.) —
  <https://productimageserver.com/literature/ownersManual/56206OM.pdf>
  - p. 34 — *Damping*: the list of independently damped parameters, 0–9 s
  - p. 51 — *Use SOG as boat speed* ("SOG will be used in the true wind
    calculations")
  - p. 53 — *Masthead unit adjustment*, with the worked 33°/27° → 3° offset
    example
  - pp. 53–54 — *TWA / TWS Correction tables*, the two calibration methods, and
    **"−10% is the default value"** for the TWS correction
  - p. 56 — *Use COG as heading*
  - p. 79 — *Apparent wind angle / speed*: **"back-calculated from the True Wind
    data so as to include True Wind Correction data"**; masthead cal defaults 1.04
  - p. 88 — *Heel angle*: "used by Hercules systems to correct wind data for the
    change of orientation of the sensor in the airflow"
  - p. 89 — *Leeway* definition (heading vs course through the water)
  - p. 99 — *True Wind Angle*: the calculation chain and the wind-triangle figure
  - p. 100 — *True wind direction* ("corrected for errors induced by aerodynamic
    effects via True Wind correction tables along with Heel Angle correction if
    available (Hercules)") and ***True Wind Speed*: "the speed of the wind
    measured relative to the water surface"**
- **B&G Triton2 Operator Manual** (Navico) —
  <https://busse-yachtshop.de/pdf/bg-Triton2-operator-manual.pdf>
  - p. 62 — *Use SOG as boat speed*
  - p. 63 — *MHU alignment*; ***True wind angle*: "only available if an H5000 CPU
    is connected"**
  - p. 64 — ***True wind speed*: same H5000 gating, same −10 % default**;
    ***Motion*: same gating, plus 3D motion sensor + mast height + Hercules**,
    and "When the wind is measured it is initially corrected for masthead unit
    alignment offset and mast rotation"
- **B&G Zeus3 Operator + Installation Manual** (combined, 198 pp.) —
  <https://cache.tradeinn.com/web/pdf/manuales/eng_bandg_manu_zeus3.pdf>
  - IM p. 24 — *Rotating mast compensation* ("the apparent and calculated wind";
    disable when an H5000 is present)
  - IM p. 27 — *Damping*, *Calibration* ("ONLY be applied locally to this unit"),
    *Water speed calibration* (50–200 %), *Water speed averaging* (1–30 s)
  - **Negative evidence:** no wind-calibration section, no heel correction, no
    TWA/TWS tables anywhere in the document
- **Ockam System Manual**, edition of 17 February 2009 (Ockam Instruments) —
  <https://ockam.com/wp-content/uploads/2025/06/New-Ockam-Sys-Manual.pdf>
  - p. 15 — *True wind*: "the wind relative to the water; i.e. as if the boat
    were not moving"
  - p. 18 — *Heel*: "used to correct the true wind readings, calculate leeway
    (used in true wind and dead-reckoning), correct boatspeed tack-to-tack"
  - p. 26 — *Leeway* definition
  - p. 30 — ***CAL Upwash / CAL Upwash Slope***: the physics, the full functional
    form, "apparent wind angle has a 3:1 effect on true wind angle (and therefore
    wind direction) upwind", typical slope +0.200 to +0.350
  - p. 62 — *Wind shear & Gradient* (after Marchaj), and why calibration must
    avoid both
  - p. 66 — initial-setup calibration values: **Cal Upwash −3.0, Cal Upwash Slope
    0.300, Cal Leeway 8.0, Cal Windspeed Apparent 1.09**
  - pp. 69–71 — *CAL Windspeed* and *CAL Upwash* worksheets: **"Change Cal
    approximately 1.25% per degree of change in Wind Direction"** (windspeed, at
    AWA 90°) and **"approximately 0.3° per degree"** (upwash, at AWA ~30°)
  - p. 71 — *Calibration qualification*: **5–7° tack-to-tack after a first
    session, 3° with more effort**
  - pp. 73–74 — *Fine tuning*: closed forms for `UPWASH` and
    `LEEWAY = (CAL LEEWAY)·HEEL / BOATSPEED²`
  - p. 83 — *Adjust True Wind angle* (O4, shear compensation, "now generally
    deprecated because it masks wind shear"); *Adjust Reef & Flat*
- **nke Marine Electronics — Regatta Processor** —
  <https://nke-marine-electronics.fr/project/regatta-processor/>
  "True wind … is the result of a sophisticated calculation integrating boat
  speed, apparent wind angle and speed, drift, heel angle, mast twist…";
  **"A 25° heel angle generates approximately a 2.5° error on true wind angle
  value."**
- **Sailmon Calibration Manual and Data Reference v3.0** (2023) —
  <https://sailmon.com/wp-content/uploads/2023/06/Sailmon-Calibration-Manual-and-Data-Reference-V3.0.pdf>
  pp. 2–6 — wind gradient (and the deck-sensor gradient measurement), wind shear
  (and why to avoid calibrating below 10 kn), upwash, and the worked
  **"3–5° per tack" / "true wind tacking"** example with TWD 4° vs 356°.
- **Expedition help, v5** (Nick White / Expedition) —
  <https://www.blur.se/images/Expedition_Help_v5.pdf>
  "Leeway" (`Leeway = k × heel / bsp²`; "Expedition, B&G and Ockam systems all do
  this"; TWA relative to track vs heading); "True wind angle" (upwash, heel, mast
  twist, gradient, and building a TWA table from tack-to-tack TWD); "True wind
  speed" (**"B&G instruments have a simple, but effective solution in which the
  difference is entered in a calibration table and subtracted downwind"**);
  calibration reference (Twa/Tws tables, k ≈ 7–8 for many purposes).

### Primary — standards, rating rules and reference implementations

- **ORC VPP Documentation 2023** (Offshore Racing Congress) —
  <https://orc.org/uploads/files/ORC-VPP-Documentation-2023.pdf>
  §7.1 *Wind Triangle* — the heel factor on the cross-track component, the
  **log wind profile eq. 7.1 with `zref = 10.0 m` and `z0 = 0.005 m`** (and the
  2022 footnote explaining the change from 0.001), and the apparent-wind
  relations eqs. 7.2/7.3. §7.2 — the TWS/TWA grid polars are computed on.
- **canboat** — `docs/canboat.json`, `WIND_REFERENCE` lookup and PGN 130306
  *Wind Data* field layout —
  <https://github.com/canboat/canboat>
  The five NMEA 2000 wind references, including the distinction between
  "True (boat referenced)", "True (ground referenced to North)" and
  "True (water referenced)" that NMEA 0183 cannot express.
- **NMEA Revealed** (Eric S. Raymond / gpsd) —
  <https://gpsd.gitlab.io/gpsd/NMEA.html>
  `MWV` (angle 0–359, reference `R`/`T`, units `K`/`M`/`N`, status `A`/`V`),
  `MWD`, `VHW`, `VPW` field layouts.
- **Signal K `signalk-derived-data`** —
  <https://github.com/SignalK/signalk-derived-data>
  `src/calcs/windGround.ts` (the vector subtraction, verbatim in §1),
  `src/calcs/leeway.ts` (`k·heel/stw²`, k default 12, "typically from 9 to 16
  (9 for super racer)", citing Arvel Gentry), `src/calcs/leewayAngle.ts`
  (the ±30° clamp and the CTW = HDT + LEE convention).
- **OpenCPN Tactics plugin manual** —
  <https://opencpn-manuals.github.io/main/tactics/index.html>
  "Leeway = hullshape-factor*heel/(STW*STW)"; the explicit "Correct STW with
  Leeway", "Correct AWS/AWA with Heel" and "Use SOG instead of STW for True Wind
  Calc" options, with the note that manufacturers typically pre-correct.

### Secondary — used for corroboration, flagged as such

- **Sailboat Instruments blog, "Corrections to the apparent wind angle"** —
  <http://sailboatinstruments.blogspot.com/2011/02/corrections-to-apparent-wind-angle.html>
  Source of the `awa_corrected = atan(tan(awa)/cos(heel))` form used in §2.1, and
  the worked "≈1.5° at AWA 30° / heel 20°" figure. The author attributes the
  geometry to Arvel Gentry's *Sailboat Performance Testing Techniques*. Used
  because it states the formula explicitly; the magnitude is independently
  corroborated by NKE's 2.5° @ 25°.
- **"The ORCA Sailing Processor (Part 2): A Deep Dive into True Wind Magic"** —
  <https://rarerarebird.blogspot.com/2025/11/the-orca-sailing-processor-part-2-deep.html>
  A third independent statement of the **6–10° tack-to-tack TWD** magnitude for
  uncorrected upwash, and of the 10 m gradient normalisation. Vendor-adjacent
  and not peer-reviewed; used only where it agrees with Sailmon and Ockam.
- **Copelands Sailing Blog, "Configuring TWD and TWS on a B&G Zeus 3"** —
  <https://copelands.blog/2019/08/29/configuring-true-wind-direction-twd-and-true-wind-speed-tws-on-a-bg-zeus-3-chart-plotter/>
  Community evidence that enabling "Use COG as Heading" and "Use SOG as Boat
  Speed" is the *routine* fix owners apply on this exact plotter — i.e. that the
  ground-referenced case in §4 is common, not hypothetical. Not relied on for
  any documented behaviour.
- Sailing Anarchy / Sailboat Owners forum threads on B&G TWA calibration —
  consulted, and consistent with the manuals, but nothing above rests on them.

### Computation

The magnitude tables in §2.1, §2.4, §2.5, §2.8 and the leeway table were
computed from the formulas quoted above, over six representative polar points
for a ~35 ft cruiser-racer (beat 40–42° at TWS 8/12/18, reach 70°/90° at 12,
run 140° at 12, 165° at 18, with plausible boat speeds). They are **my
arithmetic on published formulas**, not quoted figures, and are flagged as
such in each table. The two places where an independent published number exists
— NKE's 2.5° at 25° heel, and Ockam's 0.3°-per-degree upwash worksheet — both
agree with the computation to within the precision either side states.
