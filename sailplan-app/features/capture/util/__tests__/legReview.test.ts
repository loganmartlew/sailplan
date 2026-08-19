import {
  groupSailedLegParts,
  sailedLegDraftChanged,
  steadyBinsWithin,
  summarizeSailedLegs,
  type SailedLegPart,
} from '../legReview';

const minute = 60_000;

function part(overrides: Partial<SailedLegPart> & { id: number }): SailedLegPart {
  return {
    ordinal: 1,
    name: 'Start → North Head',
    startTime: 0,
    endTime: 10 * minute,
    reviewedAt: null,
    used: true,
    courseMarkId: null,
    sailSpans: [{ startTime: 0, endTime: 10 * minute, sailId: null }],
    ...overrides,
  };
}

describe('groupSailedLegParts', () => {
  it('keeps one row per ordinal as one leg', () => {
    const groups = groupSailedLegParts([
      part({ id: 1, ordinal: 1 }),
      part({ id: 2, ordinal: 2 }),
    ]);
    expect(groups.map(group => group.map(item => item.id))).toEqual([[1], [2]]);
  });

  it('joins the rows of a leg interrupted by a data gap', () => {
    const groups = groupSailedLegParts([
      part({ id: 1, ordinal: 1, startTime: 0, endTime: 4 * minute }),
      part({ id: 2, ordinal: 1, startTime: 6 * minute, endTime: 10 * minute }),
      part({ id: 3, ordinal: 2 }),
    ]);
    expect(groups.map(group => group.map(item => item.id))).toEqual([[1, 2], [3]]);
  });

  it('does not join two runs of the same ordinal that are not adjacent', () => {
    const groups = groupSailedLegParts([
      part({ id: 1, ordinal: 1 }),
      part({ id: 2, ordinal: 2 }),
      part({ id: 3, ordinal: 1 }),
    ]);
    expect(groups).toHaveLength(3);
  });
});

describe('steadyBinsWithin', () => {
  const mask = [
    { startTime: 0, endTime: 45_000 },
    { startTime: 60_000, endTime: 80_000 },
  ];

  it('counts only whole 15 second bins', () => {
    expect(steadyBinsWithin(mask, 0, 100_000)).toBe(4);
  });

  it('counts the overlap, not the whole stretch', () => {
    expect(steadyBinsWithin(mask, 20_000, 100_000)).toBe(2);
  });

  it('is zero when a window touches no stretch', () => {
    expect(steadyBinsWithin(mask, 45_000, 60_000)).toBe(0);
  });

  it('ignores a stretch that overlaps by less than one bin', () => {
    expect(steadyBinsWithin(mask, 35_000, 45_000)).toBe(0);
  });
});

describe('summarizeSailedLegs', () => {
  const mask = [{ startTime: 0, endTime: 60_000 }];

  it('reports duration, sails and bins for one leg', () => {
    const [summary] = summarizeSailedLegs({
      legs: [
        part({
          id: 1,
          sailSpans: [
            { startTime: 0, endTime: 30_000, sailId: null },
            { startTime: 30_000, endTime: 10 * minute, sailId: 7 },
          ],
        }),
      ],
      mask,
      samples: [{ timestamp: 0 }, { timestamp: 5_000 }, { timestamp: 99 * minute }],
    });
    expect(summary).toMatchObject({
      ordinal: 1,
      name: 'Start → North Head',
      durationMs: 10 * minute,
      reviewed: false,
      used: true,
      sailIds: [7],
      steadyBins: 4,
      attributedBins: 2,
      sampleCount: 2,
    });
  });

  it('excludes a data gap from the leg duration', () => {
    const [summary] = summarizeSailedLegs({
      legs: [
        part({ id: 1, startTime: 0, endTime: 4 * minute, sailSpans: [] }),
        part({ id: 2, startTime: 6 * minute, endTime: 10 * minute, sailSpans: [] }),
      ],
      mask: [],
      samples: [],
    });
    expect(summary.durationMs).toBe(8 * minute);
    expect(summary.startTime).toBe(0);
    expect(summary.endTime).toBe(10 * minute);
  });

  it('is reviewed when any of its stored parts is', () => {
    const [summary] = summarizeSailedLegs({
      legs: [
        part({ id: 1, startTime: 0, endTime: 4 * minute }),
        part({ id: 2, startTime: 6 * minute, endTime: 10 * minute, reviewedAt: 5 }),
      ],
      mask: [],
      samples: [],
    });
    expect(summary.reviewed).toBe(true);
  });

  it('falls back to an ordinal name when the leg has none', () => {
    const [summary] = summarizeSailedLegs({
      legs: [part({ id: 1, ordinal: 3, name: null })],
      mask: [],
      samples: [],
    });
    expect(summary.name).toBe('Leg 3');
  });
});

describe('sailedLegDraftChanged', () => {
  const stored = {
    ordinal: 1,
    name: 'Start → North Head',
    used: true,
    spans: [
      { startTime: 0, endTime: 30_000, sailId: null },
      { startTime: 30_000, endTime: 90_000, sailId: 7 },
    ],
  };

  it('is false for a save that writes back exactly what is stored', () => {
    expect(sailedLegDraftChanged(stored, { ...stored })).toBe(false);
  });

  it('is true when a sail changes', () => {
    expect(
      sailedLegDraftChanged(stored, {
        ...stored,
        spans: [stored.spans[0], { ...stored.spans[1], sailId: 8 }],
      }),
    ).toBe(true);
  });

  it('is true when a divider moves', () => {
    expect(
      sailedLegDraftChanged(stored, {
        ...stored,
        spans: [
          { startTime: 0, endTime: 45_000, sailId: null },
          { startTime: 45_000, endTime: 90_000, sailId: 7 },
        ],
      }),
    ).toBe(true);
  });

  it('is true when a block is split', () => {
    expect(
      sailedLegDraftChanged(stored, {
        ...stored,
        spans: [
          stored.spans[0],
          { startTime: 30_000, endTime: 60_000, sailId: 7 },
          { startTime: 60_000, endTime: 90_000, sailId: 7 },
        ],
      }),
    ).toBe(true);
  });

  it('is true when the leg is struck out', () => {
    expect(sailedLegDraftChanged(stored, { ...stored, used: false })).toBe(true);
  });

  it('is true when the leg is renamed', () => {
    expect(sailedLegDraftChanged(stored, { ...stored, name: 'Second beat' })).toBe(true);
  });

  it('ignores whitespace either side of an unchanged name', () => {
    expect(
      sailedLegDraftChanged(stored, { ...stored, name: '  Start → North Head ' }),
    ).toBe(false);
  });

  it('does not read a missing stored name as a rename to the default', () => {
    expect(
      sailedLegDraftChanged(
        { ...stored, name: null },
        { ...stored, name: 'Leg 1' },
      ),
    ).toBe(false);
  });
});
