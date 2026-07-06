import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar';
import type { InterpolatedLimits } from '../util/limitScoring';
import type { ConfidenceTier } from './confidenceTier';
import type { SuggestionGuardResult } from './guard';
import type { WindZone } from './windZone';

/** Reasoning captured at evaluation time (before ranking). */
export interface EvaluationReasoning {
  polarUsed: boolean;
  limitUsed: boolean;
  guardPenaltyTotal: number;
  pointsUsed: PolarPoint[];
  /**
   * The interpolated usable-TWA window the limit score was computed against
   * (explicit user limits or the implicit polar-coverage envelope). Both bounds
   * are null when the sail has no usable-range signal at all.
   */
  usableTwa: InterpolatedLimits;
}

/** Reasoning after ranking — adds the blend weights `rankSails` resolved. */
export interface RankedEvaluationReasoning extends EvaluationReasoning {
  polarWeight: number;
  limitWeight: number;
}

/**
 * Evaluate-time record produced by `evaluateSail`. It holds only the signals
 * that can be computed per-sail; the normalisation-dependent `polarScore` and
 * `rankingScore` are added later, on a *new* record, by `rankSails`.
 */
export interface SailEvaluation {
  sail: Sail;
  predictedSpeed: number | null;
  confidence: number;
  confidenceTier: ConfidenceTier;
  windZone: WindZone;
  limitScore: number | null;
  hasLimits: boolean;
  limitsExceeded: boolean;
  guards: SuggestionGuardResult[];
  reasoning: EvaluationReasoning;
}

/**
 * Ranking-time record produced (never mutated) by `rankSails`. It adds the
 * normalised `polarScore`, the final `rankingScore`, and the resolved blend
 * weights.
 */
export interface RankedSailEvaluation extends SailEvaluation {
  polarScore: number | null;
  rankingScore: number;
  reasoning: RankedEvaluationReasoning;
}
