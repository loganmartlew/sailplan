import {
  assignSpanSail,
  canSpanHoldBin,
  deleteDivider,
  findNearestDivider,
  moveDivider,
  nudgeSpanEdge,
  removeSpan,
  splitSpan,
} from '../spanEditing';

const SECOND = 1_000;

describe('splitSpan', () => {
  it('splits a block in half and keeps its sail assignment on both halves', () => {
    expect(
      splitSpan(
        [{ startTime: 0, endTime: 40 * SECOND, sailId: 7 }],
        0,
      ),
    ).toEqual([
      { startTime: 0, endTime: 20 * SECOND, sailId: 7 },
      { startTime: 20 * SECOND, endTime: 40 * SECOND, sailId: 7 },
    ]);
  });

  it('refuses a split that cannot leave two 15 second blocks', () => {
    const spans = [{ startTime: 0, endTime: 29 * SECOND, sailId: null }];

    expect(splitSpan(spans, 0)).toBe(spans);
  });
});

describe('findNearestDivider', () => {
  it('finds the divider closest to a drag starting anywhere on the band', () => {
    const spans = [
      { startTime: 0, endTime: 20 * SECOND, sailId: null },
      { startTime: 20 * SECOND, endTime: 60 * SECOND, sailId: 7 },
      { startTime: 60 * SECOND, endTime: 90 * SECOND, sailId: null },
    ];

    expect(findNearestDivider(spans, 12 * SECOND)).toBe(1);
    expect(findNearestDivider(spans, 52 * SECOND)).toBe(2);
  });
});

describe('canSpanHoldBin', () => {
  it('identifies a block shorter than the 15 second bin window', () => {
    expect(canSpanHoldBin({ startTime: 0, endTime: 14_999, sailId: 7 })).toBe(false);
    expect(canSpanHoldBin({ startTime: 0, endTime: 15_000, sailId: 7 })).toBe(true);
  });
});

describe('assignSpanSail', () => {
  it('uses the same block interaction for a sail and not used', () => {
    const spans = [{ startTime: 0, endTime: 30 * SECOND, sailId: null }];

    expect(assignSpanSail(spans, 0, 7)[0].sailId).toBe(7);
    expect(assignSpanSail(spans, 0, null)[0].sailId).toBeNull();
  });
});

describe('deleteDivider', () => {
  it('merges adjacent blocks and restores the left block assignment', () => {
    expect(deleteDivider([
      { startTime: 0, endTime: 30 * SECOND, sailId: 7 },
      { startTime: 30 * SECOND, endTime: 50 * SECOND, sailId: null },
      { startTime: 50 * SECOND, endTime: 90 * SECOND, sailId: 8 },
    ], 1)).toEqual([
      { startTime: 0, endTime: 50 * SECOND, sailId: 7 },
      { startTime: 50 * SECOND, endTime: 90 * SECOND, sailId: 8 },
    ]);
  });
});

describe('removeSpan', () => {
  it('can remove the first block by retaining the block to its right', () => {
    expect(removeSpan([
      { startTime: 0, endTime: 20 * SECOND, sailId: null },
      { startTime: 20 * SECOND, endTime: 60 * SECOND, sailId: 7 },
      { startTime: 60 * SECOND, endTime: 90 * SECOND, sailId: null },
    ], 0)).toEqual([
      { startTime: 0, endTime: 60 * SECOND, sailId: 7 },
      { startTime: 60 * SECOND, endTime: 90 * SECOND, sailId: null },
    ]);
  });
});

describe('nudgeSpanEdge', () => {
  const spans = [
    { startTime: 0, endTime: 40 * SECOND, sailId: null },
    { startTime: 40 * SECOND, endTime: 80 * SECOND, sailId: 7 },
  ];

  it('moves the selected block edge by an exact phone-friendly step', () => {
    expect(nudgeSpanEdge(spans, 1, 'start', -15 * SECOND)).toEqual([
      { startTime: 0, endTime: 25 * SECOND, sailId: null },
      { startTime: 25 * SECOND, endTime: 80 * SECOND, sailId: 7 },
    ]);
    expect(nudgeSpanEdge(spans, 0, 'end', 5 * SECOND)).toEqual([
      { startTime: 0, endTime: 45 * SECOND, sailId: null },
      { startTime: 45 * SECOND, endTime: 80 * SECOND, sailId: 7 },
    ]);
  });
});

describe('moveDivider', () => {
  const spans = [
    { startTime: 0, endTime: 40 * SECOND, sailId: null },
    { startTime: 40 * SECOND, endTime: 80 * SECOND, sailId: 7 },
  ];

  it('moves the shared edge without changing either block assignment', () => {
    expect(moveDivider(spans, 1, 55 * SECOND)).toEqual([
      { startTime: 0, endTime: 55 * SECOND, sailId: null },
      { startTime: 55 * SECOND, endTime: 80 * SECOND, sailId: 7 },
    ]);
  });

  it('clamps a divider so both neighbouring blocks remain at least 15 seconds', () => {
    expect(moveDivider(spans, 1, 5 * SECOND)).toEqual([
      { startTime: 0, endTime: 15 * SECOND, sailId: null },
      { startTime: 15 * SECOND, endTime: 80 * SECOND, sailId: 7 },
    ]);
    expect(moveDivider(spans, 1, 75 * SECOND)).toEqual([
      { startTime: 0, endTime: 65 * SECOND, sailId: null },
      { startTime: 65 * SECOND, endTime: 80 * SECOND, sailId: 7 },
    ]);
  });

  it('does not jump backwards when an existing 10 second tail guard is nudged shorter', () => {
    const guarded = [
      { startTime: 0, endTime: 90 * SECOND, sailId: 7 },
      { startTime: 90 * SECOND, endTime: 100 * SECOND, sailId: null },
    ];

    expect(moveDivider(guarded, 1, 95 * SECOND)).toEqual(guarded);
    expect(moveDivider(guarded, 1, 85 * SECOND)).toEqual([
      { startTime: 0, endTime: 85 * SECOND, sailId: 7 },
      { startTime: 85 * SECOND, endTime: 100 * SECOND, sailId: null },
    ]);
  });
});
