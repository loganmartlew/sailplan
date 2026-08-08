import type {
  RankedSailEvaluation,
  SailEvaluation,
} from '../model/sailEvaluation';
import type { SuggestionConfig } from '../model/suggestionConfig';

/**
 * Smoothstep in [0, 1]: 0 at/below `e0`, 1 at/above `e1`, with a smooth
 * (C¹-continuous) ramp between — no cliffs.
 */
function smoothstep(x: number, e0: number, e1: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Normalises, scores, sorts, and selects the top sail suggestions.
 *
 * Takes the {@link SailEvaluation} records from `evaluateSail()` and returns
 * **new** {@link RankedSailEvaluation} records — inputs are never mutated, and
 * `ranked` shares no references with the input array.
 *
 * Steps:
 *
 * 1. **Normalise polar scores** — divide each sail's predicted speed by the
 *    fastest *trusted* sail's speed (finding 2.2: a single low-confidence
 *    over-estimate must not deflate everyone's polar score).
 *
 * 2. **Blend into one continuous score** — every sail lands on one 0–~1.05
 *    scale regardless of how much polar data it has (finding 1.1):
 *
 *      w            = smoothstep(confidence, lowConfidence, highConfidence)
 *      rankingScore = w·polarScore + (1−w)·limitScore + ε·confidence − guard
 *
 *    At high confidence this converges to polars-dominate; at low confidence to
 *    pure limit ranking (the fallback philosophy). `ε·confidence` is an
 *    evidence tiebreaker: an equally-good polars-proven sail edges out a
 *    limits-only one. Confidence *tiers* are display labels only — nothing
 *    here branches on them.
 *
 * 3. **Sort** — descending by ranking score.
 *
 * 4. **Select suggestions** — every sail within an additive `margin` of the
 *    leader (finding 2.3), capped at `maxSuggested`. Robust for negative and
 *    near-zero leaders. `isFallback` flags a leader below `fallbackScoreFloor`.
 *
 * @returns `ranked` (all evaluations, new records, sorted), `suggested` (top
 *          picks), and `isFallback`.
 */
export function rankSails(
  evaluations: SailEvaluation[],
  config: SuggestionConfig,
): {
  ranked: RankedSailEvaluation[];
  suggested: RankedSailEvaluation[];
  isFallback: boolean;
} {
  const { blend, confidenceTiers, selection } = config;

  // --- Step 1: Normalise polar scores against the trusted pool ---
  // Only sails at/above the moderate confidence gate contribute to maxSpeed, so
  // a garbage low-confidence over-estimate can't deflate trustworthy sails.
  // (A low-confidence sail may then get polarScore > 1; the blend gives it
  // near-zero polar weight, so that's harmless.)
  const trusted = evaluations.filter(
    e =>
      e.predictedSpeed !== null &&
      e.predictedSpeed > 0 &&
      e.confidence >= confidenceTiers.moderate,
  );
  const pool = trusted.length > 0 ? trusted : evaluations;
  const maxSpeed = pool.reduce(
    (max, e) =>
      e.predictedSpeed !== null && e.predictedSpeed > max
        ? e.predictedSpeed
        : max,
    0,
  );

  // --- Step 2: Build a new ranked record per sail with the continuous blend ---
  const ranked: RankedSailEvaluation[] = evaluations.map(evaluation => {
    const { predictedSpeed, confidence, limitScore, reasoning } = evaluation;
    const guardPenalty = reasoning.guardPenaltyTotal;

    const polarScore =
      maxSpeed > 0 && predictedSpeed !== null && predictedSpeed > 0
        ? predictedSpeed / maxSpeed
        : null;

    // w = 0 with no polar evidence (pure limits); otherwise the smoothstep.
    const w = polarScore === null ? 0 : smoothstep(confidence, blend.lowConfidence, blend.highConfidence);

    let rankingScore: number;
    let polarWeight: number;
    let limitWeight: number;

    if (polarScore !== null && limitScore !== null) {
      polarWeight = w;
      limitWeight = 1 - w;
      rankingScore =
        w * polarScore +
        (1 - w) * limitScore +
        blend.evidenceBonus * confidence -
        guardPenalty;
    } else if (polarScore !== null) {
      polarWeight = w;
      limitWeight = 0;
      rankingScore =
        w * polarScore + blend.evidenceBonus * confidence - guardPenalty;
    } else if (limitScore !== null) {
      polarWeight = 0;
      limitWeight = 1;
      rankingScore = limitScore - guardPenalty;
    } else {
      // Neither polars nor limits — unrankable.
      polarWeight = 0;
      limitWeight = 0;
      rankingScore = -Infinity;
    }

    return {
      ...evaluation,
      polarScore,
      rankingScore,
      reasoning: { ...reasoning, polarWeight, limitWeight },
    };
  });

  // --- Step 3: Sort by rankingScore descending ---
  ranked.sort((a, b) => b.rankingScore - a.rankingScore);

  // --- Step 4: Select the "suggested" subset ---
  const eligible = ranked.filter(e => e.rankingScore > -Infinity);
  if (eligible.length === 0) {
    return { ranked, suggested: [], isFallback: false };
  }

  const leaderScore = eligible[0].rankingScore;
  // Additive margin: robust across the whole score range (incl. negatives). The
  // leader always satisfies its own margin, so `suggested` is never empty here.
  const suggested = eligible
    .filter(e => e.rankingScore >= leaderScore - selection.margin)
    .slice(0, selection.maxSuggested);

  const isFallback = leaderScore < selection.fallbackScoreFloor;

  return { ranked, suggested, isFallback };
}
