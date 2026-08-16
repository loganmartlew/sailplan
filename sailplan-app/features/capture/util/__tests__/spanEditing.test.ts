import {
  assignSpanSail,
  deleteDivider,
  findNearestDivider,
  mergeSpan,
  moveDivider,
  nudgeSpanEdge,
  spanFallsShortOfBin,
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

  it('refuses to split a no-data block', () => {
    const spans = [{ startTime: 0, endTime: 90 * SECOND, sailId: null, gap: true }];

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

  it('never offers a divider that bounds a no-data block', () => {
    const spans = [
      { startTime: 0, endTime: 20 * SECOND, sailId: 7 },
      { startTime: 20 * SECOND, endTime: 60 * SECOND, sailId: null, gap: true },
      { startTime: 60 * SECOND, endTime: 90 * SECOND, sailId: null },
      { startTime: 90 * SECOND, endTime: 120 * SECOND, sailId: 8 },
    ];

    expect(findNearestDivider(spans, 21 * SECOND)).toBe(3);
    expect(findNearestDivider(spans.slice(0, 2), 21 * SECOND)).toBeNull();
  });
});

describe('spanFallsShortOfBin', () => {
  it('warns only about a block carrying a sail — a trim is meant to be short', () => {
    expect(spanFallsShortOfBin({ startTime: 0, endTime: 14_999, sailId: 7 })).toBe(true);
    expect(spanFallsShortOfBin({ startTime: 0, endTime: 15_000, sailId: 7 })).toBe(false);
    expect(spanFallsShortOfBin({ startTime: 0, endTime: 6_000, sailId: null })).toBe(false);
  });
});

describe('assignSpanSail', () => {
  it('uses the same block interaction for a sail and no sail', () => {
    const spans = [{ startTime: 0, endTime: 30 * SECOND, sailId: null }];

    expect(assignSpanSail(spans, 0, 7)[0].sailId).toBe(7);
    expect(assignSpanSail(spans, 0, null)[0].sailId).toBeNull();
  });

  it('refuses to put a sail on a no-data block', () => {
    const spans = [{ startTime: 0, endTime: 30 * SECOND, sailId: null, gap: true }];

    expect(assignSpanSail(spans, 0, 7)).toBe(spans);
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

describe('mergeSpan', () => {
  const spans = [
    { startTime: 0, endTime: 30 * SECOND, sailId: 7 },
    { startTime: 30 * SECOND, endTime: 50 * SECOND, sailId: null },
    { startTime: 50 * SECOND, endTime: 90 * SECOND, sailId: 8 },
  ];

  it('gives a merged block the time of both and the sail of the absorbing neighbour', () => {
    expect(mergeSpan(spans, 1, 'left')).toEqual([
      { startTime: 0, endTime: 50 * SECOND, sailId: 7 },
      { startTime: 50 * SECOND, endTime: 90 * SECOND, sailId: 8 },
    ]);
    expect(mergeSpan(spans, 1, 'right')).toEqual([
      { startTime: 0, endTime: 30 * SECOND, sailId: 7 },
      { startTime: 30 * SECOND, endTime: 90 * SECOND, sailId: 8 },
    ]);
  });

  it('can remove the first block, which merge-into-previous alone could not', () => {
    expect(mergeSpan(spans, 0, 'right')).toEqual([
      { startTime: 0, endTime: 50 * SECOND, sailId: null },
      { startTime: 50 * SECOND, endTime: 90 * SECOND, sailId: 8 },
    ]);
    expect(mergeSpan(spans, 0, 'left')).toBe(spans);
    expect(mergeSpan(spans, 2, 'right')).toBe(spans);
  });

  it('never merges through a no-data block', () => {
    const gapped = [
      { startTime: 0, endTime: 30 * SECOND, sailId: 7 },
      { startTime: 30 * SECOND, endTime: 50 * SECOND, sailId: null, gap: true },
      { startTime: 50 * SECOND, endTime: 90 * SECOND, sailId: 8 },
    ];

    expect(mergeSpan(gapped, 0, 'right')).toBe(gapped);
    expect(mergeSpan(gapped, 2, 'left')).toBe(gapped);
    expect(mergeSpan(gapped, 1, 'left')).toBe(gapped);
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

  it('holds the edges of a no-data block fixed', () => {
    const gapped = [
      { startTime: 0, endTime: 40 * SECOND, sailId: 7 },
      { startTime: 40 * SECOND, endTime: 80 * SECOND, sailId: null, gap: true },
      { startTime: 80 * SECOND, endTime: 120 * SECOND, sailId: 8 },
    ];

    expect(moveDivider(gapped, 1, 55 * SECOND)).toBe(gapped);
    expect(moveDivider(gapped, 2, 95 * SECOND)).toBe(gapped);
  });
});
