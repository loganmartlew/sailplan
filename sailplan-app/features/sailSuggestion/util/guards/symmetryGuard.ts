import type { SuggestionGuard } from '../../model/guard';

const THRESHOLD_TWA = 160;
const PENALTY_PER_DEGREE = 0.05;
const MAX_PENALTY = 1.0;

export const symmetryGuard: SuggestionGuard = {
  name: 'symmetry',
  evaluate(sail, twa, _tws) {
    if (sail.symmetrical) {
      // Symmetric spinnakers: penalize when TWA < 160°
      if (twa < THRESHOLD_TWA) {
        const degrees = THRESHOLD_TWA - twa;
        const penalty = Math.min(degrees * PENALTY_PER_DEGREE, MAX_PENALTY);
        return {
          guardName: 'symmetry',
          penalty,
          reason: `Symmetric sail at TWA ${twa}° (< ${THRESHOLD_TWA}°)`,
        };
      }
    } else {
      // Asymmetric sails: penalize when TWA > 160°
      if (twa > THRESHOLD_TWA) {
        const degrees = twa - THRESHOLD_TWA;
        const penalty = Math.min(degrees * PENALTY_PER_DEGREE, MAX_PENALTY);
        return {
          guardName: 'symmetry',
          penalty,
          reason: `Asymmetric sail at TWA ${twa}° (> ${THRESHOLD_TWA}°)`,
        };
      }
    }

    return null;
  },
};
