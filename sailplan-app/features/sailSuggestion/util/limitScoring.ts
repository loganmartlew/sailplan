import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';

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
 * @param tws  - The current true wind speed to interpolate at.
 * @param limits - All TWA limit rows for one sail, in any order.
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

const ONE_SIDED_OFFSET = 20;
const OUTSIDE_FLOOR = -0.5;

/**
 * Scores how well a TWA angle fits within the sail's allowed TWA window.
 *
 * Uses a raised-cosine bell curve centered on the midpoint of the TWA range:
 * - Score = 1.0 at the center of [minTwa, maxTwa] (ideal angle).
 * - Score tapers smoothly to 0.0 at the edges (still within limits).
 * - Score goes negative outside the limits, linearly decaying to a floor
 *   of -0.5 (penalises out-of-range but doesn't dominate ranking).
 *
 * One-sided limits (only min or only max defined) assume a synthetic range
 * by adding/subtracting a fixed offset. Returns null when no limits are
 * defined, indicating the score is not applicable.
 *
 * @param twa    - The true wind angle to evaluate.
 * @param minTwa - Lower TWA boundary (null if undefined).
 * @param maxTwa - Upper TWA boundary (null if undefined).
 * @returns A score in the range [-0.5, 1.0], or null if no limits exist.
 */
export function computeLimitScore(
  twa: number,
  minTwa: number | null,
  maxTwa: number | null,
): number | null {
  if (minTwa === null && maxTwa === null) return null;

  let center: number;
  let halfRange: number;

  if (minTwa !== null && maxTwa !== null) {
    // Two-sided: center and range are derived directly from the window.
    center = (minTwa + maxTwa) / 2;
    halfRange = (maxTwa - minTwa) / 2;
  } else if (minTwa !== null) {
    // Only a minimum: assume the ideal is slightly above the min.
    center = minTwa + ONE_SIDED_OFFSET;
    halfRange = ONE_SIDED_OFFSET;
  } else {
    // Only a maximum: assume the ideal is slightly below the max.
    center = maxTwa! - ONE_SIDED_OFFSET;
    halfRange = ONE_SIDED_OFFSET;
  }

  if (halfRange <= 0) halfRange = 1; // guard against degenerate min === max

  // t = 0 at center, t = 1 at edge, t > 1 outside the range.
  const t = Math.abs(twa - center) / halfRange;

  if (t <= 1) {
    // Inside range: raised cosine bell, 1.0 → 0.0.
    return 0.5 * (1 + Math.cos(Math.PI * t));
  }

  // Outside range: gentle linear penalty, floored at OUTSIDE_FLOOR.
  return Math.max(OUTSIDE_FLOOR, -0.5 * (t - 1));
}
