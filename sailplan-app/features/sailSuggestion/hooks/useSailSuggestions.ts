import { useMemo } from 'react';
import type { SailSuggestionData } from '../api/getSailSuggestionData';
import { suggestSails } from '../util/suggestSails';

export function useSailSuggestions(
  data: SailSuggestionData | null,
  twa: number | null,
  tws: number | null,
) {
  return useMemo(() => {
    if (!data || twa === null || tws === null) {
      return null;
    }

    return suggestSails(twa, tws, data.sails, data.allPolars, data.allLimits);
  }, [data, twa, tws]);
}
