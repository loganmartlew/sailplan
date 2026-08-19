import { comparePromotionWithTable } from '../promotionReview';
import {
  promotionBandLabel,
  promotionDeltaLabel,
  promotionTableNote,
  promotionTwsLabel,
} from '../promotionLabels';
import type { ProposedPolarPoint } from '../promotion';

const point = (overrides: Partial<ProposedPolarPoint>): ProposedPolarPoint => ({
  legOrdinal: 1,
  sailId: 7,
  tws: 12,
  twa: 40,
  speed: 6.5,
  sampleCount: 40,
  retainedCount: 40,
  ...overrides,
});

/** A dense hand-entered table for sail 7, so the comparison has real support. */
const storedTable = [10, 11, 12, 13, 14].flatMap(tws =>
  [32, 36, 40, 44, 48, 52].map(twa => ({
    sailId: 7,
    tws,
    twa,
    speed: 5 + tws * 0.1,
    sourceKind: 'manual' as const,
  })),
);

describe('comparePromotionWithTable', () => {
  it('groups a sail into ten-degree bands carrying the TWS range that fed them', () => {
    const rows = comparePromotionWithTable(
      [
        point({ tws: 11, twa: 40, speed: 6.2 }),
        point({ tws: 13, twa: 44, speed: 6.8 }),
        point({ tws: 12, twa: 52, speed: 7 }),
      ],
      storedTable,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sailId: 7,
      bandStartTwa: 40,
      bandEndTwa: 50,
      minTws: 11,
      maxTws: 13,
      capturedSpeed: 6.5,
      pointCount: 2,
    });
    expect(rows[1]).toMatchObject({ bandStartTwa: 50, bandEndTwa: 60, pointCount: 1 });
  });

  it('states the delta against the stored table', () => {
    const [row] = comparePromotionWithTable([point({ tws: 12, speed: 6.7 })], storedTable);
    expect(row.storedSpeed).toBeCloseTo(6.2, 5);
    expect(row.delta).toBeCloseTo(0.5, 5);
    expect(row.support).not.toBe('none');
  });

  it('offers a confidence cue rather than a delta where the table has no support', () => {
    const [row] = comparePromotionWithTable([point({ twa: 140, speed: 9 })], storedTable);
    expect(row.storedSpeed).toBeNull();
    expect(row.delta).toBeNull();
    expect(row.support).toBe('none');
  });

  it('never compares a sail against another sail’s table', () => {
    const [row] = comparePromotionWithTable([point({ sailId: 8 })], storedTable);
    expect(row.sailId).toBe(8);
    expect(row.support).toBe('none');
  });

  it('reads a whole race as one table per sail per band', () => {
    const rows = comparePromotionWithTable(
      [
        point({ legOrdinal: 1, twa: 40, speed: 6.4 }),
        point({ legOrdinal: 3, twa: 44, speed: 6.6 }),
        point({ legOrdinal: 2, sailId: 8, twa: 140, speed: 9 }),
      ],
      storedTable,
    );
    expect(rows.map(row => [row.sailId, row.bandStartTwa, row.pointCount])).toEqual([
      [7, 40, 2],
      [8, 140, 1],
    ]);
  });

  it('has nothing to show when nothing was proposed', () => {
    expect(comparePromotionWithTable([], storedTable)).toEqual([]);
  });
});

describe('promotion review labels', () => {
  const row = (overrides: Partial<ReturnType<typeof comparePromotionWithTable>[number]>) => ({
    ...comparePromotionWithTable([point({})], storedTable)[0],
    ...overrides,
  });

  it('names the band and the wind range that fed it', () => {
    expect(promotionBandLabel(row({ bandStartTwa: 40, bandEndTwa: 50 }))).toBe('40\u201350\u00b0');
    expect(promotionTwsLabel(row({ minTws: 11, maxTws: 13 }))).toBe('11\u201313.0 kn');
    expect(promotionTwsLabel(row({ minTws: 12, maxTws: 12 }))).toBe('12.0 kn');
  });

  it('signs the delta and calls a hair’s breadth no change', () => {
    expect(promotionDeltaLabel(row({ delta: 0.34 }))).toBe('+0.3');
    expect(promotionDeltaLabel(row({ delta: -0.34 }))).toBe('\u22120.3');
    expect(promotionDeltaLabel(row({ delta: 0.01 }))).toBe('\u00b10.0');
    expect(promotionDeltaLabel(row({ delta: null }))).toBeNull();
  });

  it('says why there is no comparison instead of showing one', () => {
    expect(promotionTableNote(row({ storedSpeed: null, delta: null, support: 'none' })))
      .toBe('Your table says nothing near these conditions');
    expect(promotionTableNote(row({ storedSpeed: 6.2, support: 'low' })))
      .toBe('Your table says 6.2 kn, on thin support');
    expect(promotionTableNote(row({ storedSpeed: 6.2, support: 'high' })))
      .toBe('Your table says 6.2 kn');
  });
});
