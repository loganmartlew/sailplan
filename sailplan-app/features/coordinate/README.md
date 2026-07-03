# Coordinate Feature

Geographic and wind-angle math, plus the UI for entering coordinates. This is the
shared toolbox the [plan feature](../plan/README.md) uses to turn marks + wind
into bearing, TWA, and tack. Terms used here (bearing, TWA, tack, DMS/DMM) are
defined in the [domain glossary](../../docs/domain-glossary.md).

Everything is exported from the barrel: `import { coordsToBearing, getTwa } from
'~/features/coordinate'`.

## Bearing & TWA (`util/bearing.ts`)

### `coordsToBearing({ from, to }) → number`

Initial great-circle **bearing** (0–360°) from one coordinate to another, using
the standard `atan2` forward-azimuth formula. This is the compass heading you'd
sail to get from `from` to `to`.

### `getTwa({ twd, bearing }) → { angle, tack }`

Computes the **true wind angle** and **tack** from the wind direction (TWD) and a
bearing:

- `angle` — normalised absolute difference, `0–180°` (`0` = into wind, `180` =
  dead downwind).
- `tack`:
  - `starboard` when the signed TWD−bearing angle is positive (wind from the
    right),
  - `port` when negative (wind from the left),
  - `null` at exactly `0°` or `180°` (no defined tack).

Both angles are normalised into range before the difference is taken, so raw
compass inputs are fine.

Helpers `degreesToRadians` / `radiansToDegrees` are exported alongside.

## Coordinate formats (`util/mappers.ts`)

Coordinates are stored internally as **signed decimal degrees**. Users enter and
read them as DMS or DMM (the `coordFormat` setting). Conversions:

| Function                              | Converts                          |
| ------------------------------------- | --------------------------------- |
| `dmsToDecimal(d, m, s, cardinality)`  | Degrees-Minutes-Seconds → decimal |
| `decimalToDMS(decimal)`               | decimal → `{ d, m, s, cardinality }` |
| `dmmToDecimal(d, m, cardinality)`     | Degrees-Decimal-Minutes → decimal |
| `decimalToDMM(decimal)`               | decimal → `{ d, m, cardinality }` |
| `compassToCardinality(dir)`           | `N/E → +1`, `S/W → −1`            |
| `cardinalityToCompass(card, field)`   | sign + `latitude`/`longitude` → `N/S/E/W` |

**Cardinality** is the sign (`-1 | 1`); **compass direction** (`N/S/E/W`) is how
it's shown, resolved against whether the field is latitude or longitude. Decimal
results are rounded to 8 dp.

## Other utilities

- `util/center.ts` — computes the center point of a set of coordinates (for
  framing a map region).
- `util/types.ts` — `Coordinate`, `TWA`, `CompassDirection`, `Cardinality`,
  `CoordFormat`.

## UI components

- `CoordinateInput` / `CoordinateForm` — DMS/DMM-aware coordinate entry.
- `CoordinateDialog` — modal wrapper for coordinate entry.
- `CoordFormatInfoButton` — explains DMS vs DMM to the user.

## Files

```
coordinate/
├── index.ts
├── util/
│   ├── bearing.ts     coordsToBearing, getTwa, deg/rad helpers   (+ __tests__/bearing-test.ts)
│   ├── mappers.ts     DMS/DMM ↔ decimal, cardinality ↔ compass
│   ├── center.ts      center of a coordinate set
│   └── types.ts       Coordinate, TWA, CompassDirection, Cardinality, CoordFormat
└── components/
    ├── CoordinateInput.tsx
    ├── CoordinateForm.tsx
    ├── CoordinateDialog.tsx
    └── CoordFormatInfoButton.tsx
```

## Tests

`util/__tests__/bearing-test.ts` covers the bearing/TWA math. Keep new math pure
and unit-tested — see [testing.md](../../docs/testing.md).
