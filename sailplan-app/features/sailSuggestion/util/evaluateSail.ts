import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import { estimateSailSpeed } from '~/features/sailPolar/util/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type { SuggestionGuard, SuggestionGuardResult } from '../model/guard';
import type { SailEvaluation } from '../model/sailEvaluation';
import { classifyConfidence } from '../model/confidenceTier';
import { getWindZone } from '../model/windZone';
import { interpolateTwaLimits, computeLimitScore } from './limitScoring';

/**
 * Evaluates a single sail for the given wind conditions.
 *
 * This is the per-sail step of the suggestion pipeline. It assembles all the
 * contributing signals — polar performance, TWA limit fit, and guard penalties
 * — into a single {@link SailEvaluation} record that can later be compared
 * across sails by the ranking step.
 *
 * Pipeline:
 * 1. **Wind zone** — classify the TWA into upwind / reaching / downwind.
 * 2. **Polar interpolation** — estimate boat speed via IDW from the sail's
 *    polar data and derive a confidence score for the prediction.
 * 3. **Confidence tier** — map the raw confidence to high / moderate / low
 *    using zone-specific thresholds.
 * 4. **TWA limit scoring** — interpolate the sail's min/max TWA boundaries
 *    at this TWS, then score how well the requested TWA fits inside them.
 * 5. **Guards** — run each registered guard (e.g. symmetry) and collect any
 *    penalties that should reduce the sail's ranking score.
 *
 * Note: `polarScore` and `rankingScore` are left as placeholders (null / 0)
 * here — they are filled in by {@link rankSails} after all sails have been
 * evaluated and maximum speed is known for normalisation.
 */
export function evaluateSail(
  sail: Sail,
  twa: number,
  tws: number,
  polars: PolarPoint[],
  limits: SailTwaLimit[],
  guards: SuggestionGuard[],
): SailEvaluation {
  // 1. Classify wind zone from TWA.
  const windZone = getWindZone(twa);

  // 2. IDW-interpolate predicted speed from the sail's polar grid.
  const { predictedSpeed, confidence, pointsUsed } = estimateSailSpeed(
    { tws, twa },
    polars,
  );

  // 3. Map raw confidence (0-1) to a discrete tier (high/moderate/low)
  //    using thresholds that vary by wind zone.
  const confidenceTier = classifyConfidence(confidence, windZone);

  // 4. Interpolate the sail's TWA boundaries at this TWS and score
  //    how well the requested TWA fits within them.
  const { minTwa, maxTwa } = interpolateTwaLimits(tws, limits);
  const hasLimits = limits.length > 0;
  const limitScore = computeLimitScore(twa, minTwa, maxTwa);
  const limitsExceeded = limitScore !== null && limitScore < 0;

  // 5. Run each guard and accumulate penalties.
  const guardResults: SuggestionGuardResult[] = [];
  for (const guard of guards) {
    const result = guard.evaluate(sail, twa, tws);
    if (result) guardResults.push(result);
  }
  const guardPenaltyTotal = guardResults.reduce((sum, r) => sum + r.penalty, 0);

  return {
    sail,
    predictedSpeed,
    confidence,
    confidenceTier,
    windZone,
    limitScore,
    hasLimits,
    limitsExceeded,
    polarScore: null, // set during ranking (needs max speed across all sails)
    rankingScore: 0, // set during ranking
    guards: guardResults,
    reasoning: {
      polarUsed: polars.length > 0,
      limitUsed: hasLimits,
      polarWeight: 0, // set during ranking
      limitWeight: 0, // set during ranking
      guardPenaltyTotal,
      pointsUsed,
    },
  };
}
