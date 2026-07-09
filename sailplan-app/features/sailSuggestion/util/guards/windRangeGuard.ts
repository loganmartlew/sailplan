import type { SuggestionGuard } from '../../model/guard';

/**
 * Penalises a sail flown outside its user-declared usable wind-speed range
 * (`minTws`/`maxTws` on the sail) — the one fact the rest of the model can't
 * express: "this sail is not used at all outside this wind band" (Package I).
 *
 * - Inside `[minTws, maxTws]` (either bound nullable → unbounded that side):
 *   no penalty.
 * - Outside: a penalty ramping linearly with the TWS excess over the edge, at
 *   `penaltyPerKnot`, capped at `maxPenalty`. The cap is sized to exceed the
 *   full ranking-score span, so any out-of-range sail ranks below every
 *   in-range one — a soft taper, never a veto (decision D6). The sail stays in
 *   the breakdown and can still be the flagged `isFallback` pick when nothing
 *   is in range.
 *
 * The reason string names the crossed bound and the TWS so the breakdown dialog
 * explains the penalty for free via the existing guard rendering.
 */
export const windRangeGuard: SuggestionGuard = {
  name: 'windRange',
  evaluate(ctx) {
    const { sail, tws, config } = ctx;
    const { penaltyPerKnot, maxPenalty } = config.windRangeGuard;
    const { minTws, maxTws } = sail;

    let excess: number;
    let bound: number;
    let direction: string;
    if (minTws != null && tws < minTws) {
      excess = minTws - tws;
      bound = minTws;
      direction = 'below';
    } else if (maxTws != null && tws > maxTws) {
      excess = tws - maxTws;
      bound = maxTws;
      direction = 'above';
    } else {
      return null;
    }

    const penalty = Math.min(excess * penaltyPerKnot, maxPenalty);
    return {
      guardName: 'windRange',
      penalty,
      reason: `TWS ${tws} kt ${direction} sail's wind range (${bound} kt)`,
    };
  },
};
