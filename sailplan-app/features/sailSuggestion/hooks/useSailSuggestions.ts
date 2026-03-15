import { useMemo } from 'react';
import { useBoatProfile } from '~/features/boatProfile';
import { useSailSuggestionData } from '../api/getSailSuggestionData';
import { suggestSails } from '../util/suggestSails';

export function useSailSuggestions(twa: number | null, tws: number | null) {
  const { boatProfile } = useBoatProfile();
  const data = useSailSuggestionData(boatProfile?.id ?? null);

  return useMemo(() => {
    if (!boatProfile?.id || twa === null || tws === null || !data) {
      return null;
    }

    return suggestSails(twa, tws, data.sails, data.allPolars, data.allLimits);
  }, [boatProfile?.id, data, twa, tws]);
}
