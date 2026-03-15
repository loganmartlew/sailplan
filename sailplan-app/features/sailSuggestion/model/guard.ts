import type { Sail } from '~/features/sail';

export interface SuggestionGuardResult {
  guardName: string;
  penalty: number;
  reason: string;
}

export interface SuggestionGuard {
  name: string;
  evaluate(sail: Sail, twa: number, tws: number): SuggestionGuardResult | null;
}
