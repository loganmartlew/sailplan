import type { SuggestionGuard } from '../../model/guard';

/**
 * Nudges the ranking away from the wrong symmetry at extreme angles — a hint,
 * never a veto.
 *
 * - Symmetric sails are penalised below `deadBandMinTwa`; asymmetric sails
 *   above `deadBandMaxTwa`. The band between (≈150–170°) covers normal
 *   crossover angles (shy runner, soaked asym) and is penalty-free.
 * - The slope/cap are sized against the ~1.05 ranking-score scale, so the worst
 *   case (`maxPenalty` ≈ 0.2) is a fraction of it, not the whole polar range.
 * - When `skipWhenLimitsDefined` and the sail has user-entered TWA limits, the
 *   guard defers entirely: the user's limits are strictly better evidence than
 *   this hardcoded `symmetrical`-flag heuristic.
 *
 * Note: `symmetrical: false` proxies "asymmetric kite" for a downwind-focused
 * fleet; a jib/main (schema default `false`) can misfire here, but the 0.2 cap
 * keeps the worst case small. A dedicated `sailType` column is deferred work.
 */
export const symmetryGuard: SuggestionGuard = {
  name: 'symmetry',
  evaluate(ctx) {
    const { sail, twa, hasLimits, config } = ctx;
    const {
      deadBandMinTwa,
      deadBandMaxTwa,
      penaltyPerDegree,
      maxPenalty,
      skipWhenLimitsDefined,
    } = config.symmetryGuard;

    if (skipWhenLimitsDefined && hasLimits) return null;

    if (sail.symmetrical && twa < deadBandMinTwa) {
      const degrees = deadBandMinTwa - twa;
      const penalty = Math.min(degrees * penaltyPerDegree, maxPenalty);
      return {
        guardName: 'symmetry',
        penalty,
        reason: `Symmetric sail at TWA ${twa}° (< ${deadBandMinTwa}°)`,
      };
    }

    if (!sail.symmetrical && twa > deadBandMaxTwa) {
      const degrees = twa - deadBandMaxTwa;
      const penalty = Math.min(degrees * penaltyPerDegree, maxPenalty);
      return {
        guardName: 'symmetry',
        penalty,
        reason: `Asymmetric sail at TWA ${twa}° (> ${deadBandMaxTwa}°)`,
      };
    }

    return null;
  },
};
