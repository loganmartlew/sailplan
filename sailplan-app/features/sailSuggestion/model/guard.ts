import type { Sail } from '~/features/sail';
import type { InterpolatedLimits } from '../util/limitScoring';
import type { SuggestionConfig } from './suggestionConfig';
import type { WindZone } from './windZone';

export interface SuggestionGuardResult {
  guardName: string;
  penalty: number;
  reason: string;
}

/**
 * Everything a guard may inspect. Assembled in `evaluateSail` after
 * interpolation and limit scoring, so guards can reason about wind zone,
 * user-entered limits, and polar confidence — not just the raw angle.
 */
export interface GuardContext {
  sail: Sail;
  twa: number;
  tws: number;
  windZone: WindZone;
  /** Interpolated at the current TWS; nulls when undefined. */
  limits: InterpolatedLimits;
  hasLimits: boolean;
  /** Raw polar confidence for this sail (0–1). */
  confidence: number;
  config: SuggestionConfig;
}

export interface SuggestionGuard {
  name: string;
  evaluate(ctx: GuardContext): SuggestionGuardResult | null;
}
