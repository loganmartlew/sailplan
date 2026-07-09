import type { SuggestionGuard } from '../../model/guard';
import { symmetryGuard } from './symmetryGuard';
import { windRangeGuard } from './windRangeGuard';

export const suggestionGuards: SuggestionGuard[] = [symmetryGuard, windRangeGuard];
