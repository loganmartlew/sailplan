// Deep imports, not the barrels: both of those pull `api/` — and with it the
// SQLite handle — into a module that is pure arithmetic, the way
// `sailSuggestion/util/evaluateSail.ts` already reaches for this same
// estimator.
import {
  estimateSourceAwareSailSpeed,
  type SourceAwarePolarPoint,
} from '~/features/sailPolar/util/sourceAwareInterpolation';
import {
  classifyConfidence,
  type ConfidenceTier,
} from '~/features/sailSuggestion/model/confidenceTier';
import { DEFAULT_SUGGESTION_CONFIG } from '~/features/sailSuggestion/model/suggestionConfig';
import type { ProposedPolarPoint } from './promotion';
import { getReviewBand, REVIEW_BAND_DEG } from './sailedLegDetection';
import { median } from './statistics';

/** A stored polar row, as the comparison needs to read it. */
export type StoredPolarPoint = SourceAwarePolarPoint & { sailId: number };

/**
 * One row of the promotion review: what this race says about one sail in one
 * 10° band, next to what the sailor's table already says.
 *
 * `support` is the cue for the table's side of the comparison. `'none'` means
 * the table has nothing near these conditions, and there is no delta to state —
 * showing a bare number there would invite an argument with a value the table
 * never held an opinion about.
 */
export type PromotionComparisonRow = {
  sailId: number;
  /** Band bounds, degrees of |TWA|: `[bandStartTwa, bandEndTwa)`. */
  bandStartTwa: number;
  bandEndTwa: number;
  /** The TWS range of the points feeding this band, knots. */
  minTws: number;
  maxTws: number;
  /** What this race says: the median of the band's proposed points. */
  capturedSpeed: number;
  /** What the table says at the same conditions, or null where it is silent. */
  storedSpeed: number | null;
  /** `capturedSpeed - storedSpeed`, or null with no stored answer to subtract. */
  delta: number | null;
  support: ConfidenceTier | 'none';
  pointCount: number;
};

/**
 * The promotion review, as a table per sail per 10° TWA band.
 *
 * A scatter of dots gives nothing to argue with; a band, a wind range, two
 * speeds and the difference between them does. Nothing here writes — this is
 * the comparison the sailor sees *before* deciding.
 *
 * `storedPoints` is the table as it stands. A re-promotion must exclude this
 * session's own earlier points from it, or the race is compared against itself.
 */
export function comparePromotionWithTable(
  points: readonly ProposedPolarPoint[],
  storedPoints: readonly StoredPolarPoint[],
): PromotionComparisonRow[] {
  const bands = new Map<string, ProposedPolarPoint[]>();
  for (const point of points) {
    const key = `${point.sailId}|${getReviewBand(point.twa)}`;
    const band = bands.get(key);
    if (band) band.push(point);
    else bands.set(key, [point]);
  }

  return [...bands.values()]
    .map(band => {
      const sailId = band[0].sailId;
      const table = storedPoints.filter(stored => stored.sailId === sailId);
      const estimates = band
        .map(point => estimateSourceAwareSailSpeed({ tws: point.tws, twa: point.twa }, table))
        .filter(estimate => estimate.pointsUsed.length > 0);
      const capturedSpeed = median(band.map(point => point.speed));
      const storedSpeed = estimates.length === 0
        ? null
        : median(estimates.map(estimate => estimate.predictedSpeed));
      return {
        sailId,
        bandStartTwa: getReviewBand(band[0].twa) * REVIEW_BAND_DEG,
        bandEndTwa: (getReviewBand(band[0].twa) + 1) * REVIEW_BAND_DEG,
        minTws: Math.min(...band.map(point => point.tws)),
        maxTws: Math.max(...band.map(point => point.tws)),
        capturedSpeed,
        storedSpeed,
        delta: storedSpeed === null ? null : capturedSpeed - storedSpeed,
        support: storedSpeed === null
          ? ('none' as const)
          : classifyConfidence(
              median(estimates.map(estimate => estimate.confidence)),
              DEFAULT_SUGGESTION_CONFIG.confidenceTiers,
            ),
        pointCount: band.length,
      };
    })
    .sort(
      (first, second) =>
        first.sailId - second.sailId || first.bandStartTwa - second.bandStartTwa,
    );
}
