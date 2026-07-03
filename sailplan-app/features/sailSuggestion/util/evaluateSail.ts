import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import { estimateSailSpeed } from '~/features/sailPolar/util/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type {
  GuardContext,
  SuggestionGuard,
  SuggestionGuardResult,
} from '../model/guard';
import type { SailEvaluation } from '../model/sailEvaluation';
import type { SuggestionConfig } from '../model/suggestionConfig';
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
 * 1. **Wind zone** — classify the TWA into upwind / reaching / downwind
 *    (display + guard context only; it no longer branches the scoring math).
 * 2. **Polar interpolation** — estimate boat speed from the sail's polar data
 *    and derive a confidence score for the prediction.
 * 3. **Confidence tier** — map the raw confidence to a display label using a
 *    single threshold set.
 * 4. **TWA limit scoring** — interpolate the sail's min/max TWA boundaries
 *    at this TWS, then score how well the requested TWA fits inside them.
 * 5. **Guards** — run each registered guard (e.g. symmetry) with a full
 *    context object and collect any penalties.
 *
 * `polarScore` and `rankingScore` are intentionally absent: they depend on the
 * whole fleet and are produced later, on a new record, by {@link rankSails}.
 */
export function evaluateSail(
  sail: Sail,
  twa: number,
  tws: number,
  polars: PolarPoint[],
  limits: SailTwaLimit[],
  guards: SuggestionGuard[],
  config: SuggestionConfig,
): SailEvaluation {
  // 1. Classify wind zone from TWA (display + guard context).
  const windZone = getWindZone(twa);

  // 2. Interpolate predicted speed from the sail's polar grid.
  const { predictedSpeed, confidence, pointsUsed } = estimateSailSpeed(
    { tws, twa },
    polars,
    config.interpolation,
  );

  // 3. Map raw confidence (0-1) to a discrete display tier.
  const confidenceTier = classifyConfidence(confidence, config.confidenceTiers);

  // 4. Interpolate the sail's TWA boundaries at this TWS and score how well the
  //    requested TWA fits. `hasLimits` is derived from the interpolated window
  //    (not the row count) so rows with null min *and* max don't claim a limit.
  const interpolatedLimits = interpolateTwaLimits(tws, limits);
  const { minTwa, maxTwa } = interpolatedLimits;
  const hasLimits = minTwa !== null || maxTwa !== null;
  const limitScore = computeLimitScore(twa, minTwa, maxTwa, config.limitCurve);
  const limitsExceeded = limitScore !== null && limitScore < 0;

  // 5. Run each guard with a full context and accumulate penalties.
  const guardContext: GuardContext = {
    sail,
    twa,
    tws,
    windZone,
    limits: interpolatedLimits,
    hasLimits,
    confidence,
    config,
  };
  const guardResults: SuggestionGuardResult[] = [];
  for (const guard of guards) {
    const result = guard.evaluate(guardContext);
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
    guards: guardResults,
    reasoning: {
      polarUsed: polars.length > 0,
      limitUsed: hasLimits,
      guardPenaltyTotal,
      pointsUsed,
    },
  };
}
