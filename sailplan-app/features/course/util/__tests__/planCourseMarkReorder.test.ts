import {
  ReorderableCourseMark,
  planCourseMarkReorder,
} from '../planCourseMarkReorder';

function makeCourseMarks(
  viaPointCounts: number[],
): ReorderableCourseMark[] {
  return viaPointCounts.map((viaPointCount, index) => ({
    id: (index + 1) * 10,
    viaPointCount,
  }));
}

describe('planCourseMarkReorder', () => {
  test('reorders a direct Course', () => {
    const plan = planCourseMarkReorder({
      courseMarks: makeCourseMarks([0, 0, 0]),
      from: 2,
      to: 0,
    });

    expect(plan).toEqual({
      kind: 'reorder',
      orderedCourseMarkIds: [30, 10, 20],
    });
  });

  test('blocks a move that changes a Leg holding Via Points', () => {
    const plan = planCourseMarkReorder({
      courseMarks: makeCourseMarks([2, 0, 0]),
      from: 1,
      to: 2,
    });

    expect(plan).toEqual({
      kind: 'blocked',
      blockedLegStartCourseMarkIds: [10],
    });
  });

  test('allows a move that leaves the Legs holding Via Points intact', () => {
    // The 10→20 Leg holds the Via Points and is untouched; the tail swaps.
    const plan = planCourseMarkReorder({
      courseMarks: makeCourseMarks([1, 0, 0, 0]),
      from: 3,
      to: 2,
    });

    expect(plan).toEqual({
      kind: 'reorder',
      orderedCourseMarkIds: [10, 20, 40, 30],
    });
  });

  test('blocks moving a Via-Point-holding Leg start to the end of the Course', () => {
    const plan = planCourseMarkReorder({
      courseMarks: makeCourseMarks([0, 1, 0]),
      from: 1,
      to: 2,
    });

    expect(plan).toEqual({
      kind: 'blocked',
      blockedLegStartCourseMarkIds: [20],
    });
  });

  test('is a no-op for an out-of-range or unchanged move', () => {
    const courseMarks = makeCourseMarks([0, 0]);

    expect(planCourseMarkReorder({ courseMarks, from: 0, to: 0 })).toEqual({
      kind: 'noop',
    });
    expect(planCourseMarkReorder({ courseMarks, from: 0, to: 5 })).toEqual({
      kind: 'noop',
    });
    expect(planCourseMarkReorder({ courseMarks, from: 9, to: 0 })).toEqual({
      kind: 'noop',
    });
  });
});
