import type { SailEvaluation } from './sailEvaluation';
import type { WindZone } from './windZone';

export interface SailSuggestionResult {
  evaluations: SailEvaluation[];
  suggested: SailEvaluation[];
  conditions: {
    twa: number;
    tws: number;
    windZone: WindZone;
  };
}
