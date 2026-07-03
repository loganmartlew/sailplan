import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type { SuggestionConfig } from '../model/suggestionConfig';

export interface InterpolatedLimits {
  minTwa: number | null;
  maxTwa: number | null;
}

/**
 * Linearly interpolates TWA limits for an arbitrary wind speed from the
 * discrete TWS rows stored per sail.
 *
 * Limits are defined at specific TWS values (e.g. 5, 10, 15 kts). When
 * the actual TWS falls between two rows, we interpolate both the minTwa
 * and maxTwa boundaries independently so the allowed TWA window adjusts
 * smoothly with wind speed.
 *
 * Edge handling:
 * - No limit rows → returns nulls (sail has no TWA restrictions).
 * - TWS outside the defined range → clamps to the nearest boundary row.
 * - A null on one side of a bracket propagates: if a limit is defined at
 *   one TWS but null at the other, the defined value is used for both to
 *   avoid extrapolating into undefined territory.
 *
 * **Ordering precondition:** callers pass rows ordered by `tws` (the query in
 * `api/getSailSuggestionData.ts` already orders by `sailTwaLimit.tws`). The
 * defensive re-sort below exists only to tolerate unordered ad-hoc
 * callers/tests and is otherwise redundant.
 *
 * @param tws  - The current true wind speed to interpolate at.
 * @param limits - All TWA limit rows for one sail, ordered by `tws`.
 * @returns Interpolated min/max TWA boundaries (either or both may be null).
 */
export function interpolateTwaLimits(
  tws: number,
  limits: SailTwaLimit[],
): InterpolatedLimits {
  if (limits.length === 0) return { minTwa: null, maxTwa: null };

  const sorted = [...limits].sort((a, b) => a.tws - b.tws);

  // TWS is at or beyond the defined range — return the nearest boundary row.
  if (tws <= sorted[0].tws) {
    return { minTwa: sorted[0].minTwa, maxTwa: sorted[0].maxTwa };
  }
  if (tws >= sorted[sorted.length - 1].tws) {
    const last = sorted[sorted.length - 1];
    return { minTwa: last.minTwa, maxTwa: last.maxTwa };
  }

  // Walk sorted rows to find the two that bracket the target TWS.
  let lower = sorted[0];
  let upper = sorted[1];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].tws >= tws) {
      lower = sorted[i - 1];
      upper = sorted[i];
      break;
    }
  }

  // If TWS exactly matches a row, no interpolation needed.
  if (lower.tws === tws) return { minTwa: lower.minTwa, maxTwa: lower.maxTwa };
  if (upper.tws === tws) return { minTwa: upper.minTwa, maxTwa: upper.maxTwa };

  // Blend factor: 0 at lower row, 1 at upper row.
  const t = (tws - lower.tws) / (upper.tws - lower.tws);

  // Interpolate one side (min or max) independently.
  // Both null → null.  One null → use the defined value (no extrapolation).
  const interpolateSide = (
    a: number | null,
    b: number | null,
  ): number | null => {
    if (a === null && b === null) return null;
    if (a === null) return b;
    if (b === null) return a;
    return a + t * (b - a);
  };

  return {
    minTwa: interpolateSide(lower.minTwa, upper.minTwa),
    maxTwa: interpolateSide(lower.maxTwa, upper.maxTwa),
  };
}

/**
 * Scores how well a TWA angle fits within the sail's allowed TWA window.
 *
 * A TWA window is a "safe/appropriate to fly" range, **not** a preference
 * curve — the midpoint is not the ideal angle. So the shape is a trapezoid,
 * not a bell curve:
 * - Flat **1.0** across the middle `plateauFraction` of the window — being at
 *   the deep edge of a downwind sail's window is not punished.
 * - Linear taper from 1.0 down to `edgeScore` between the plateau and the edge.
 * - Outside the window, linear decay to `outsideFloor`.
 *
 * The step from `edgeScore` (just inside) to 0 (just outside) is a
 * **deliberate discontinuity**: in-range must always beat out-of-range by a
 * margin. Do not "fix" it into a continuous curve.
 *
 * One-sided limits (only min or only max defined) assume a synthetic range
 * using `oneSidedOffsetDeg`. Returns null when no limits are defined,
 * indicating the score is not applicable.
 *
 * @param twa    - The true wind angle to evaluate.
 * @param minTwa - Lower TWA boundary (null if undefined).
 * @param maxTwa - Upper TWA boundary (null if undefined).
 * @param curve  - Trapezoid tuning from `SuggestionConfig.limitCurve`.
 * @returns A score in `[outsideFloor, 1.0]`, or null if no limits exist.
 */
export function computeLimitScore(
  twa: number,
  minTwa: number | null,
  maxTwa: number | null,
  curve: SuggestionConfig['limitCurve'],
): number | null {
  if (minTwa === null && maxTwa === null) return null;

  const { plateauFraction, edgeScore, outsideFloor, oneSidedOffsetDeg } = curve;

  let center: number;
  let halfRange: number;

  if (minTwa !== null && maxTwa !== null) {
    // Two-sided: center and range are derived directly from the window.
    center = (minTwa + maxTwa) / 2;
    halfRange = (maxTwa - minTwa) / 2;
  } else if (minTwa !== null) {
    // Only a minimum: assume the window extends a fixed offset above the min.
    center = minTwa + oneSidedOffsetDeg;
    halfRange = oneSidedOffsetDeg;
  } else {
    // Only a maximum: assume the window extends a fixed offset below the max.
    center = maxTwa! - oneSidedOffsetDeg;
    halfRange = oneSidedOffsetDeg;
  }

  if (halfRange <= 0) halfRange = 1; // guard against degenerate min === max

  // t = 0 at center, t = 1 at edge, t > 1 outside the range.
  const t = Math.abs(twa - center) / halfRange;

  if (t <= plateauFraction) {
    // Flat plateau across the middle of the window.
    return 1.0;
  }

  if (t <= 1) {
    // Linear taper from 1.0 at the plateau edge down to edgeScore at the edge.
    const taper = (t - plateauFraction) / (1 - plateauFraction);
    return 1 - taper * (1 - edgeScore);
  }

  // Outside range: gentle linear penalty, floored at outsideFloor.
  return Math.max(outsideFloor, -0.5 * (t - 1));
}
