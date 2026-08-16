import { splitLegBand, unifyLegParts } from '../legBand';

const SECOND = 1_000;

const parts = [
  [
    { startTime: 0, endTime: 25 * SECOND, sailId: null },
    { startTime: 25 * SECOND, endTime: 200 * SECOND, sailId: 7 },
  ],
  [
    { startTime: 260 * SECOND, endTime: 400 * SECOND, sailId: 8 },
    { startTime: 400 * SECOND, endTime: 410 * SECOND, sailId: null },
  ],
];

describe('unifyLegParts', () => {
  it('joins the stored parts of one leg with a fixed no-data block', () => {
    expect(unifyLegParts(parts)).toEqual([
      { startTime: 0, endTime: 25 * SECOND, sailId: null },
      { startTime: 25 * SECOND, endTime: 200 * SECOND, sailId: 7 },
      { startTime: 200 * SECOND, endTime: 260 * SECOND, sailId: null, gap: true },
      { startTime: 260 * SECOND, endTime: 400 * SECOND, sailId: 8 },
      { startTime: 400 * SECOND, endTime: 410 * SECOND, sailId: null },
    ]);
  });

  it('leaves a single-part leg exactly as it was', () => {
    expect(unifyLegParts([parts[0]])).toEqual(parts[0]);
  });
});

describe('splitLegBand', () => {
  it('serialises the unified band back into one span list per stored part', () => {
    expect(splitLegBand(unifyLegParts(parts), 2)).toEqual(parts);
  });

  it('keeps edits made either side of the gap on their own part', () => {
    const edited = unifyLegParts(parts).map(span =>
      span.startTime === 25 * SECOND ? { ...span, sailId: 9 } : span,
    );

    expect(splitLegBand(edited, 2)[0][1].sailId).toBe(9);
    expect(splitLegBand(edited, 2)[1]).toEqual(parts[1]);
  });

  it('pads with empty lists when the band has lost a gap it cannot lose', () => {
    expect(splitLegBand(parts[0], 2)).toEqual([parts[0], []]);
  });
});
