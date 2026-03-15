import type { SailEvaluation } from '../model/sailEvaluation';

const SUGGESTED_THRESHOLD = 0.8;
const MAX_SUGGESTED = 3;

/**
 * Normalises, scores, sorts, and selects the top sail suggestions.
 *
 * Operates on the array of {@link SailEvaluation} records produced by
 * `evaluateSail()`. This is the second (and final) phase of the suggestion
 * pipeline: it fills in the `polarScore`, `rankingScore`, and weight fields
 * that were left as placeholders by the evaluation step.
 *
 * Steps:
 *
 * 1. **Normalise polar scores** — divide each sail's predicted speed by the
 *    fastest sail's speed so all polar scores are on a 0-1 scale.
 *
 * 2. **Compute ranking score** — blend polar and limit scores using a
 *    weighting strategy that depends on the confidence tier:
 *    - **High** — trust polars fully; limits are a small 10 % bonus.
 *    - **Moderate** — blend polars and limits proportionally to raw
 *      confidence (higher confidence → more polar weight).
 *    - **Low** — ignore polars; rank purely by limit score. If there are no
 *      limits either, the sail is effectively unrankable (-Infinity).
 *    Guard penalties are always subtracted after blending.
 *
 * 3. **Sort** — descending by ranking score.
 *
 * 4. **Select suggestions** — take all sails within 80 % of the leader's
 *    score, clamped to a minimum of 1 and a maximum of 3 suggestions.
 *    Sails with -Infinity scores are excluded entirely.
 *
 * @returns `ranked` (all evaluations sorted) and `suggested` (the
 *          top picks to show to the user).
 */
export function rankSails(evaluations: SailEvaluation[]): {
  ranked: SailEvaluation[];
  suggested: SailEvaluation[];
} {
  // --- Step 1: Normalise polar scores ---
  // Find the fastest predicted speed across all sails to use as divisor.
  const maxSpeed = evaluations.reduce(
    (max, e) =>
      e.predictedSpeed !== null && e.predictedSpeed > max
        ? e.predictedSpeed
        : max,
    0,
  );

  for (const evaluation of evaluations) {
    if (
      maxSpeed > 0 &&
      evaluation.predictedSpeed !== null &&
      evaluation.predictedSpeed > 0
    ) {
      evaluation.polarScore = evaluation.predictedSpeed / maxSpeed;
    } else {
      evaluation.polarScore = null;
    }
  }

  // --- Step 2: Compute final rankingScore per confidence tier ---
  // Weighting strategy shifts from polar-dominant (high confidence) to
  // limit-dominant (low confidence) as the data becomes less trustworthy.
  for (const evaluation of evaluations) {
    const { confidenceTier, polarScore, limitScore, reasoning } = evaluation;
    const guardPenalty = reasoning.guardPenaltyTotal;

    switch (confidenceTier) {
      case 'high': {
        // Polars are reliable — use them as the primary signal.
        // Limits contribute a small bonus (10 %) to differentiate sails
        // with otherwise similar speeds.
        reasoning.polarWeight = 1.0;
        if (limitScore !== null) {
          reasoning.limitWeight = 0.1;
          evaluation.rankingScore =
            (polarScore ?? 0) + 0.1 * Math.max(limitScore, 0) - guardPenalty;
        } else {
          reasoning.limitWeight = 0;
          evaluation.rankingScore = (polarScore ?? 0) - guardPenalty;
        }
        break;
      }

      case 'moderate': {
        // Blend polars and limits proportionally to confidence.
        // c close to 1 → mostly polars; c close to 0 → mostly limits.
        const c = evaluation.confidence;
        reasoning.polarWeight = c;
        if (limitScore !== null) {
          reasoning.limitWeight = 1 - c;
          evaluation.rankingScore =
            c * (polarScore ?? 0) + (1 - c) * limitScore - guardPenalty;
        } else {
          reasoning.limitWeight = 0;
          evaluation.rankingScore = c * (polarScore ?? 0) - guardPenalty;
        }
        break;
      }

      case 'low': {
        // Polars are unreliable — fall back entirely to limit scoring.
        // Without limits, the sail cannot be meaningfully ranked.
        reasoning.polarWeight = 0;
        if (limitScore !== null) {
          reasoning.limitWeight = 1.0;
          evaluation.rankingScore = limitScore - guardPenalty;
        } else {
          reasoning.limitWeight = 0;
          evaluation.rankingScore = -Infinity;
        }
        break;
      }
    }
  }

  // --- Step 3: Sort by rankingScore descending ---
  const ranked = [...evaluations].sort(
    (a, b) => b.rankingScore - a.rankingScore,
  );

  // --- Step 4: Select the "suggested" subset ---
  // Keep sails within 80 % of the top score, with at least 1 and at most 3.
  const eligible = ranked.filter(e => e.rankingScore > -Infinity);

  if (eligible.length === 0) {
    return { ranked, suggested: [] };
  }

  const leaderScore = eligible[0].rankingScore;
  const threshold = leaderScore * SUGGESTED_THRESHOLD;

  const suggested = eligible.filter(e => e.rankingScore >= threshold);

  const finalSuggested =
    suggested.length === 0
      ? eligible.slice(0, 1)
      : suggested.slice(0, MAX_SUGGESTED);

  return { ranked, suggested: finalSuggested };
}
