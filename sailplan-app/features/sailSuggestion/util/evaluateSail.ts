import type { Sail } from '~/features/sail';
import type { SourceAwarePolarPoint } from '~/features/sailPolar/util/sourceAwareInterpolation';
import { estimateSourceAwareSailSpeed } from '~/features/sailPolar/util/sourceAwareInterpolation';
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
 * 4. **Trust suppression** — damp the polar confidence toward the limit fallback
 *    so an extrapolated speed can't carry the ranking outside the usable band.
 *    An implicit envelope (Package F) is damped smoothly by the trapezoid taper
 *    (its edge is a fuzzy data boundary); an explicit user limit (Package H) is
 *    a crisp window — full trust inside, zero outside.
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
  polars: SourceAwarePolarPoint[],
  limits: SailTwaLimit[],
  guards: SuggestionGuard[],
  config: SuggestionConfig,
): SailEvaluation {
  // 1. Classify wind zone from TWA (display + guard context).
  const windZone = getWindZone(twa);

  // 2. Interpolate predicted speed from the sail's polar grid.
  const { predictedSpeed, confidence: rawConfidence, pointsUsed } =
    estimateSourceAwareSailSpeed({ tws, twa }, polars, config.interpolation);

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

  // 4. Trust suppression — damp the polar confidence toward the limit fallback so
  //    an extrapolated speed can't carry the ranking at an angle the sail
  //    shouldn't fly. The two limit sources earn different curves because their
  //    edges mean different things:
  //    - **Implicit envelope (Package F)** — inferred from noisy polar coverage,
  //      so its edge is *fuzzy*. Damp smoothly by `clamp01(limitScore)`: the
  //      trapezoid taper is the graded trust as the target leaves observed data.
  //    - **Explicit user limit (Package H)** — a crisp, deliberate statement.
  //      Inside the window the user vouches for the sail *in full* (taper doubt
  //      would wrongly penalise a legitimately-usable edge angle, e.g. near a
  //      one-sided limit's max); outside it's a hard cutoff. So: full trust
  //      in-window, zero outside.
  //    Both zero out beyond the edge, dropping the sail from the normalisation
  //    pool and letting the (negative) limit fallback drive its rank. F left
  //    explicit limits unsuppressed to keep that score-space move measurable; H
  //    closes the gap so a fast sail can no longer win past its user limit.
  let confidence: number;
  if (limitScore === null) {
    confidence = rawConfidence;
  } else if (usingImplicitEnvelope) {
    confidence = rawConfidence * clamp01(limitScore);
  } else {
    confidence = limitScore < 0 ? 0 : rawConfidence;
  }

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
      usableTwa: scoringLimits,
    },
  };
}
