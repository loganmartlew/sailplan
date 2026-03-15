import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type { SailSuggestionResult } from '../model/sailSuggestion';
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
): SailSuggestionResult {
  const evaluations = sails.map(sail => {
    const polars = allPolars.get(sail.id) ?? [];
    const limits = allLimits.get(sail.id) ?? [];
    return evaluateSail(sail, twa, tws, polars, limits, suggestionGuards);
  });

  const { ranked, suggested } = rankSails(evaluations);

  return {
    evaluations: ranked,
    suggested,
    conditions: {
      twa,
      tws,
      windZone: getWindZone(twa),
    },
  };
}
