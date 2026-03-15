import type { SuggestionGuard } from '../../model/guard';
import { symmetryGuard } from './symmetryGuard';

export const suggestionGuards: SuggestionGuard[] = [symmetryGuard];
