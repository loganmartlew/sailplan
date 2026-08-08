import type { RankedSailEvaluation } from './sailEvaluation';
import type { WindZone } from './windZone';

export interface SailSuggestionResult {
  evaluations: RankedSailEvaluation[];
  suggested: RankedSailEvaluation[];
  /**
   * True when even the leading suggestion is a least-bad fallback (its score is
   * below `selection.fallbackScoreFloor` — e.g. every sail is outside its TWA
   * limits). Lets the UI distinguish a confident pick from a guess.
   */
  isFallback: boolean;
  conditions: {
    twa: number;
    tws: number;
    windZone: WindZone;
  };
}
