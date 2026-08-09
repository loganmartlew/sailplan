# Context: SailPlan

SailPlan is a sailing app. This vocabulary is assumed everywhere in the code
and can't be inferred from types alone — read it before working on the Plan,
Sail, Polar, or Suggestion features. Each term links to where it lives in
code.

## Wind

| Term    | Full name             | Meaning                                                                                 |
| ------- | ---------------------- | --------------------------------------------------------------------------------------- |
| **TWD** | True Wind Direction   | Compass direction the wind is blowing **from**, in degrees (0–360°).                     |
| **TWS** | True Wind Speed       | How hard the wind blows. **Stored canonically in knots**; `speedUnit` is display/entry only. |
| **TWA** | True Wind Angle       | Angle between the wind and the boat's heading (0–180°). `0°` = dead into wind, `180°` = dead downwind. Derived, never stored raw. |

TWD and TWS are the user's **inputs** on the Plan tab (stored transiently in the
[plan store](sailplan-app/features/plan/store/planStore.ts)). TWA is **computed** from TWD
and the boat's bearing — see [`getTwa`](sailplan-app/features/coordinate/util/bearing.ts).

## Direction & geometry

| Term        | Meaning                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ |
| **Bearing** | Compass direction (0–360°) from one point to another, i.e. the heading to sail a leg. Computed by [`coordsToBearing`](sailplan-app/features/coordinate/util/bearing.ts) (great-circle formula). |
| **Mark**    | A fixed geographic point (buoy/landmark) with a name, latitude, longitude. Table `mark`.         |
| **Leg**     | The straight sail from one mark to the next. A course is a sequence of legs.                     |
| **Course**  | An ordered list of marks (`course` + `courseMark.order`). Sailing it means sailing each leg in order. Optionally grouped by `courseGroup`. |
| **Course direction** | Optional per-mark hint (`courseMark.direction`), e.g. which side to round.               |

### TWA and tack, precisely

Given the wind direction (TWD) and the leg's bearing,
[`getTwa`](sailplan-app/features/coordinate/util/bearing.ts) returns both the **angle** and
the **tack**:

- **TWA angle** = normalised absolute difference between TWD and bearing, in
  `0–180°`.
- **Tack** = which side the wind hits:
  - **starboard** — wind from the boat's right (the signed angle is positive).
  - **port** — wind from the boat's left (signed angle negative).
  - `null` at exactly `0°` or `180°` (head-to-wind or dead downwind — no defined
    tack).

Sailors can't sail directly into the wind, so a low TWA on a leg means you'd have
to tack (zig-zag) — the app surfaces the angle and tack so you know what the leg
demands.

## Points of sail (wind zones)

TWA is bucketed into a **wind zone**, used to pick confidence thresholds during
sail suggestion ([`getWindZone`](sailplan-app/features/sailSuggestion/model/windZone.ts)):

| Zone       | TWA range | Plain meaning                                  |
| ---------- | --------- | ---------------------------------------------- |
| `upwind`   | < 80°     | Sailing toward the wind (close-hauled/beating) |
| `reaching` | 80°–150°  | Wind roughly across the boat                   |
| `downwind` | > 150°    | Wind from behind (running)                     |

## Sails

| Term          | Meaning                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| **Sail**      | A specific sail owned by a boat profile (`sail`): name, `color`, optional `sailArea`, and two flags.  |
| **Symmetrical** | Whether the sail is symmetric. Drives the *symmetry guard*: symmetric sails (e.g. spinnakers) are penalised at tighter angles, asymmetric sails at very deep angles. |
| **Masthead**  | Whether the sail hoists to the masthead (vs. fractional). Stored; describes rig geometry.             |
| **Sail area** | Sail size in `areaUnit` (default m²). Optional.                                                       |

Different sails are fast in different conditions; the whole point of the app is
picking the right one for the leg's TWA/TWS.

## Polars

| Term            | Meaning                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| **Polar**       | A sail's performance model: at a given TWS and TWA, how fast (`speed`) the boat goes. Stored as many discrete points in `sailPolar`. |
| **Polar point** | One `(tws, twa, speed)` sample. `PolarPoint` in code.                                                       |
| **Polar import batch** | One successful CSV polar import, retained as a provenance unit so the points it contributes can be identified and removed together. |
| **Polar diagram** | The classic radial plot of speed vs. wind angle. Rendered as `polar` or `scatter` chart (`polarChartType` setting). |
| **Interpolation** | Estimating boat speed at a TWS/TWA that isn't an exact stored point — **bilinear** over the polar grid, falling back to **Inverse Distance Weighting (IDW)** over nearby points when the data isn't gridded. See [`features/sailPolar`](sailplan-app/features/sailPolar/README.md). |
| **Confidence**  | How trustworthy an interpolated speed is (0–1), based on how close/dense/bracketing the nearby polar points are. Bucketed into high/moderate/low **tiers**. |

**Units:** every speed in the database — `sailPolar.tws`, `sailPolar.speed`,
`sail.minTws`/`maxTws`, `sailTwaLimit.tws` — is stored in **knots**. The
`speedUnit` setting converts on entry and on display only; it never changes what
is stored. See `convertSpeed`/`formatSpeed` in
[`lib/format.ts`](sailplan-app/lib/format.ts).

## TWA limits

| Term          | Meaning                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| **TWA limit** | The usable angular range for a sail at a given wind speed: a `minTwa` and/or `maxTwa` at a `tws` (`sailTwaLimit`). Below/above the range the sail is a poor choice. |
| **Limit score** | A bell-curve score of how well the requested TWA sits inside a sail's limits — 1.0 at the centre of the band, tapering to negative outside. Used when polar data is sparse. See [`limitScoring`](sailplan-app/features/sailSuggestion/util/limitScoring.ts). |

## Coordinate formats

Latitude/longitude can be entered/displayed two ways (`coordFormat` setting):

| Format  | Full name                | Example        |
| ------- | ------------------------- | -------------- |
| **DMS** | Degrees Minutes Seconds  | `36° 50' 30" S`|
| **DMM** | Degrees Decimal Minutes  | `36° 50.5' S`  |

Internally coordinates are stored as **signed decimal degrees**; conversion
helpers are in
[`features/coordinate/util/mappers.ts`](sailplan-app/features/coordinate/util/mappers.ts).
**Hemisphere** (N/S for latitude, E/W for longitude) sets the sign — the defaults
(`S`/`E`) suit the app's New Zealand origin.

## Boat profile

A **boat profile** (`boatProfile`) represents one boat's setup. Sails, polars,
and TWA limits all belong to a profile, and one profile is always active (see
[architecture.md](sailplan-app/docs/architecture.md#provider--startup-chain)). Switching profiles
switches the whole sail inventory the app reasons about.

## NMEA capture

| Term | Meaning |
| ---- | ------- |
| **NMEA source** | A plotter or gateway offering an NMEA 0183 TCP stream. A source discovered through GoFree has a name/model and a currently announced endpoint; it has no guaranteed durable identifier. |
| **Plotter setup** | The per-boat-profile method for locating its NMEA source: either automatic discovery of a selected source or a manually pinned host and port. Being configured does **not** mean the source is currently reachable. |
| **NMEA connection** | The live runtime relationship in which SailPlan is receiving valid NMEA data from the configured source. It may be connected, retrying, or absent independently of whether plotter setup exists. |
| **Raw log** | The verbatim NMEA sentence stream captured alongside a recording. It is durable-but-disposable evidence for debugging, reprocessing, and export—not the recording itself. Removing it leaves the parsed recording and its polar contribution intact; removing the recording withdraws the whole contribution. |
| **Sail stamp** | A timestamped observation that a particular sail was up at that instant. A stamp does not itself claim the surrounding samples or remain in force until another stamp; review may use it as evidence when proposing editable sail-attribution spans. |
| **Sail-attribution span** | An interval of recording samples assigned to one sail, either proposed as a review draft or confirmed by the sailor. The app may infer draft spans from sail stamps and surrounding conditions, but only confirmed spans can contribute to polar promotion. |

## Putting it together

The Plan flow chains these concepts:

```
marks (from → to)      ──► bearing
TWD + bearing          ──► TWA + tack
TWA → wind zone
TWA + TWS + sails
  → interpolate polars ──► predicted speed + confidence tier
  → score TWA limits
  → apply guards (e.g. symmetry)
  → rank                ──► suggested sail(s)
```

See [`features/plan`](sailplan-app/features/plan/README.md) and
[`features/sailSuggestion`](sailplan-app/features/sailSuggestion/README.md) for the
mechanics.

## Non-app folders

`polars/` (fixture generator for polar test data) has no domain model of its
own — it consumes the same TWS/TWA/polar vocabulary defined above but adds no
new terms.
