import { sailSpanInsertsFor } from '../spanPersistence';

const SECOND = 1_000;

describe('sailSpanInsertsFor', () => {
  it('writes only the columns, so a split block cannot carry its parent row id', () => {
    // Both halves of a split spread the stored row they came from, id included.
    const split = [
      { id: 42, sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: 7 },
      { id: 42, sailedLegId: 3, startTime: 30 * SECOND, endTime: 60 * SECOND, sailId: 7 },
    ];

    expect(sailSpanInsertsFor({ sailedLegId: 3, spans: split, used: true })).toEqual([
      { sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: 7 },
      { sailedLegId: 3, startTime: 30 * SECOND, endTime: 60 * SECOND, sailId: 7 },
    ]);
  });

  it('never writes a no-data block — the gap is drawn, not stored', () => {
    expect(sailSpanInsertsFor({
      sailedLegId: 3,
      spans: [
        { startTime: 0, endTime: 30 * SECOND, sailId: 7 },
        { startTime: 30 * SECOND, endTime: 60 * SECOND, sailId: null, gap: true },
      ],
      used: true,
    })).toEqual([{ sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: 7 }]);
  });

  it('clears sails on a leg the sailor marked not used', () => {
    expect(sailSpanInsertsFor({
      sailedLegId: 3,
      spans: [{ startTime: 0, endTime: 30 * SECOND, sailId: 7 }],
      used: false,
    })).toEqual([{ sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: null }]);
  });
});
