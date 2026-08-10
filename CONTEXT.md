# Context: SailPlan

SailPlan is a sailing app. This vocabulary is assumed everywhere in the code
and can't be inferred from types alone — read it before working on the Plan,
Sail, Polar, or Suggestion features. Each term links to where it lives in
code.

## Wind

| Term    | Full name             | Meaning                                                                                 |
| ------- | ---------------------- | --------------------------------------------------------------------------------------- |
| **TWD** | True Wind Direction   | Compass direction the wind is blowing **from**, in degrees (0–360°).                     |
| **TWS** | True Wind Speed       | How hard the wind blows. Stored/entered in the user's `speedUnit` (default knots).       |
| **TWA** | True Wind Angle       | Angle between the wind and the boat's heading (0–180°). `0°` = dead into wind, `180°` = dead downwind. Derived, never stored raw. |

TWD and TWS are the user's **inputs** on the Plan tab (stored transiently in the
[plan store](sailplan-app/features/plan/store/planStore.ts)). TWA is **computed** from TWD
and the boat's bearing — see [`getTwa`](sailplan-app/features/coordinate/util/bearing.ts).

## Direction & geometry

| Term        | Meaning                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ |
| **Bearing** | Compass direction (0–360°) from one point to another, i.e. the heading to sail a leg. Computed by [`coordsToBearing`](sailplan-app/features/coordinate/util/bearing.ts) (great-circle formula). |
| **Mark**    | A reusable fixed geographic point (buoy/landmark) with a name, latitude, and longitude. Table `mark`. |
| **Course Mark** | A Mark used in a Course as a Leg boundary. A Mark's role is course-specific: the same saved Mark may instead be used as a Via Point in another Course. |
| **Via point** | A directionless role inside a Leg, chosen by the sailor to shape the Course's intended route around a known constraint. It may reference a reusable Mark or hold course-local coordinates; promoting local coordinates to a Mark does not change the point's role. It does not assert that the route is navigable, and port/starboard course direction applies only to Course Marks. _Avoid:_ boundary (a boundary is a line or area, not a point). |
| **Leg**     | The portion of a Course from one Course Mark to the next Course Mark. A Leg may contain Via Points and therefore multiple Leg Segments. |
| **Leg Segment** | A straight portion of a Leg between consecutive Course Marks or Via Points. Bearing, TWA, tack, and sail guidance apply to each Leg Segment. _Avoid:_ sub-leg, route segment. |
| **Course**  | An ordered route through Course Marks, with optional Via Points inside its Legs. Sailing it means sailing each Leg in order; future plans inherit its route. Optionally grouped by `courseGroup`. |
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
| **Polar diagram** | The classic radial plot of speed vs. wind angle. Rendered as `polar` or `scatter` chart (`polarChartType` setting). |
| **Interpolation** | Estimating boat speed at a TWS/TWA that isn't an exact stored point — **bilinear** over the polar grid, falling back to **Inverse Distance Weighting (IDW)** over nearby points when the data isn't gridded. See [`features/sailPolar`](sailplan-app/features/sailPolar/README.md). |
| **Confidence**  | How trustworthy an interpolated speed is (0–1), based on how close/dense/bracketing the nearby polar points are. Bucketed into high/moderate/low **tiers**. |

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
