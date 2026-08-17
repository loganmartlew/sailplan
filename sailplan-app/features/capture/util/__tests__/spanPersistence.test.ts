import { sailSpanInsertsFor } from '../spanPersistence';

const SECOND = 1_000;

describe('sailSpanInsertsFor', () => {
  it('writes only the columns, so a split block cannot carry its parent row id', () => {
    // Both halves of a split spread the stored row they came from, id included.
    const split = [
      { id: 42, sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: 7 },
      { id: 42, sailedLegId: 3, startTime: 30 * SECOND, endTime: 60 * SECOND, sailId: 7 },
    ];

    expect(sailSpanInsertsFor({ sailedLegId: 3, spans: split })).toEqual([
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
    })).toEqual([{ sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: 7 }]);
  });

  it('keeps the sail assignments on a leg the sailor marked not used', () => {
    // "Not used" is `sailedLeg.used`, a column. Encoding it by erasing sailIds
    // destroyed the sailor's work on a race they cannot sail again, and left a
    // confirmed-but-unattributed leg indistinguishable from a struck-out one.
    expect(sailSpanInsertsFor({
      sailedLegId: 3,
      spans: [{ startTime: 0, endTime: 30 * SECOND, sailId: 7 }],
    })).toEqual([{ sailedLegId: 3, startTime: 0, endTime: 30 * SECOND, sailId: 7 }]);
  });
});
