import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type { SailSuggestionResult } from '../model/sailSuggestion';
import {
  DEFAULT_SUGGESTION_CONFIG,
  type SuggestionConfig,
} from '../model/suggestionConfig';
import { getWindZone } from '../model/windZone';
import { evaluateSail } from './evaluateSail';
import { suggestionGuards } from './guards/guardRegistry';
import { rankSails } from './rankSails';

export function suggestSails(
  twa: number,
  tws: number,
  sails: Sail[],
  allPolars: Map<number, PolarPoint[]>,
  allLimits: Map<number, SailTwaLimit[]>,
  config: SuggestionConfig = DEFAULT_SUGGESTION_CONFIG,
): SailSuggestionResult {
  const evaluations = sails.map(sail => {
    const polars = allPolars.get(sail.id) ?? [];
    const limits = allLimits.get(sail.id) ?? [];
    return evaluateSail(sail, twa, tws, polars, limits, suggestionGuards, config);
  });

  const { ranked, suggested, isFallback } = rankSails(evaluations, config);

  return {
    evaluations: ranked,
    suggested,
    isFallback,
    conditions: {
      twa,
      tws,
      windZone: getWindZone(twa),
    },
  };
}
