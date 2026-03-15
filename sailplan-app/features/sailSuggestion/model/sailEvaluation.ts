import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar';
import type { ConfidenceTier } from './confidenceTier';
import type { SuggestionGuardResult } from './guard';
import type { WindZone } from './windZone';

export interface EvaluationReasoning {
  polarUsed: boolean;
  limitUsed: boolean;
  polarWeight: number;
  limitWeight: number;
  guardPenaltyTotal: number;
  pointsUsed: PolarPoint[];
}

export interface SailEvaluation {
  sail: Sail;
  predictedSpeed: number | null;
  confidence: number;
  confidenceTier: ConfidenceTier;
  windZone: WindZone;
  limitScore: number | null;
  hasLimits: boolean;
  limitsExceeded: boolean;
  polarScore: number | null;
  rankingScore: number;
  guards: SuggestionGuardResult[];
  reasoning: EvaluationReasoning;
}
