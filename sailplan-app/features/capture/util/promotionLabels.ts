import type { PromotionComparisonRow } from './promotionReview';

/**
 * How the promotion review reads on screen. Kept apart from the comparison
 * itself: the arithmetic changes when the blend or the bands change, the
 * wording changes when the screen does, and they are not the same occasion.
 */
const knots = (value: number) => `${value.toFixed(1)} kn`;

/** The band as the review names it, e.g. `40–50°`. */
export const promotionBandLabel = (row: PromotionComparisonRow) =>
  `${row.bandStartTwa}\u2013${row.bandEndTwa}\u00b0`;

/** The TWS range feeding a band, collapsed when one cluster fed it alone. */
export const promotionTwsLabel = (row: PromotionComparisonRow) =>
  row.minTws === row.maxTws
    ? knots(row.minTws)
    : `${row.minTws}\u2013${knots(row.maxTws)}`;

/**
 * The comparison in one phrase — or, where the table is silent, the reason
 * there is no comparison. A bare delta against nothing is the failure this
 * exists to avoid.
 */
export function promotionTableNote(row: PromotionComparisonRow): string {
  if (row.storedSpeed === null) {
    return 'Your table says nothing near these conditions';
  }
  const support = row.support === 'low'
    ? ', on thin support'
    : row.support === 'moderate'
      ? ', on some support'
      : '';
  return `Your table says ${knots(row.storedSpeed)}${support}`;
}

/** The signed delta, or null where there is nothing to subtract from. */
export function promotionDeltaLabel(row: PromotionComparisonRow): string | null {
  if (row.delta === null) return null;
  const rounded = Math.abs(row.delta) < 0.05 ? 0 : row.delta;
  return `${rounded > 0 ? '+' : rounded < 0 ? '\u2212' : '\u00b1'}${Math.abs(rounded).toFixed(1)}`;
}
