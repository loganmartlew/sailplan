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
import { deriveCoverageEnvelope } from './coverageEnvelope';
import { interpolateTwaLimits, computeLimitScore } from './limitScoring';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

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
 * 3. **TWA limit scoring** — score how well the requested TWA fits the sail's
 *    usable window. Explicit user limits win; otherwise the sail's own polar
 *    coverage stands in as an implicit envelope (Package F / decision D2).
 * 4. **Trust suppression** — for an implicit envelope, damp the polar
 *    confidence toward the limit fallback outside the observed band: absence of
 *    data at an angle is evidence the sail isn't flown there, not a licence to
 *    extrapolate. The trapezoid itself is the trust curve.
 * 5. **Confidence tier** — map the (possibly suppressed) confidence to a
 *    display label using a single threshold set.
 * 6. **Guards** — run each registered guard (e.g. symmetry) with a full
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
  const { predictedSpeed, confidence: rawConfidence, pointsUsed } =
    estimateSailSpeed({ tws, twa }, polars, config.interpolation);

  // 3. Limit scoring. Explicit user limits take precedence; when none exist the
  //    sail's own polar coverage stands in as an implicit usable-range envelope
  //    (decision D2). `hasExplicitLimits` is derived from the interpolated
  //    window (not the row count) so rows with null min *and* max don't claim a
  //    limit — and it, not the implicit envelope, is what guards key off.
  const explicitLimits = interpolateTwaLimits(tws, limits);
  const hasExplicitLimits =
    explicitLimits.minTwa !== null || explicitLimits.maxTwa !== null;

  const implicitEnvelope = hasExplicitLimits
    ? null
    : deriveCoverageEnvelope(tws, polars, config.coverageEnvelope);
  const usingImplicitEnvelope = implicitEnvelope !== null;

  const scoringLimits = hasExplicitLimits
    ? explicitLimits
    : (implicitEnvelope ?? { minTwa: null, maxTwa: null });
  const limitScore = computeLimitScore(
    twa,
    scoringLimits.minTwa,
    scoringLimits.maxTwa,
    config.limitCurve,
  );
  const limitsExceeded = limitScore !== null && limitScore < 0;

  // 4. Trust suppression for implicit envelopes. The trapezoid *is* the trust
  //    curve — clamp01(limitScore) is 1.0 across the observed band and 0
  //    outside it — so damping confidence by it makes the (now-negative) limit
  //    fallback drive the ranking instead of a trusted extrapolated speed, and
  //    drops the sail out of the normalisation pool at angles it never sailed.
  //    Explicit limits are left untouched: their behaviour must stay unchanged.
  const confidence =
    usingImplicitEnvelope && limitScore !== null
      ? rawConfidence * clamp01(limitScore)
      : rawConfidence;

  // 5. Map the (possibly suppressed) confidence to a discrete display tier.
  const confidenceTier = classifyConfidence(confidence, config.confidenceTiers);

  // 6. Run each guard with a full context and accumulate penalties. Guards see
  //    `hasExplicitLimits` as `hasLimits`: an implicit envelope is inferred
  //    data, not the user's declared intent, so it must not suppress guards.
  const guardContext: GuardContext = {
    sail,
    twa,
    tws,
    windZone,
    limits: scoringLimits,
    hasLimits: hasExplicitLimits,
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
    // `hasLimits` stays "explicit user limits" — an implicit envelope is not
    // user intent. The breakdown UI tells the two apart via `limitScore != null
    // && !hasLimits` (a participating score with no explicit limit = envelope).
    hasLimits: hasExplicitLimits,
    limitsExceeded,
    guards: guardResults,
    reasoning: {
      polarUsed: polars.length > 0,
      limitUsed: limitScore !== null,
      guardPenaltyTotal,
      pointsUsed,
    },
  };
}
