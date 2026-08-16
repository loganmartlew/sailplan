import {
  DeletableCourseMark,
  planCourseMarkDeletion,
} from '../planCourseMarkDeletion';

function makeCourseMarks(viaPointIds: number[][]): DeletableCourseMark[] {
  return viaPointIds.map((ids, index) => ({
    id: (index + 1) * 10,
    viaPointIds: ids,
  }));
}

describe('planCourseMarkDeletion', () => {
  test('merges the adjacent Legs when an interior Course Mark goes', () => {
    const plan = planCourseMarkDeletion({
      courseMarks: makeCourseMarks([[101], [102, 103], []]),
      courseMarkId: 20,
    });

    expect(plan).toEqual({
      kind: 'delete',
      courseMarkId: 20,
      reparentedViaPoints: [
        { viaPointId: 102, legStartCourseMarkId: 10, order: 1 },
        { viaPointId: 103, legStartCourseMarkId: 10, order: 2 },
      ],
      deletedViaPointIds: [],
    });
  });

  test('destroys the Leg of the first Course Mark, which has nowhere to merge', () => {
    const plan = planCourseMarkDeletion({
      courseMarks: makeCourseMarks([[101, 102], [], []]),
      courseMarkId: 10,
    });

    expect(plan).toMatchObject({
      reparentedViaPoints: [],
      deletedViaPointIds: [101, 102],
    });
  });

  test('destroys the Leg that ends at a deleted terminal Course Mark', () => {
    const plan = planCourseMarkDeletion({
      courseMarks: makeCourseMarks([[], [104], []]),
      courseMarkId: 30,
    });

    expect(plan).toMatchObject({
      reparentedViaPoints: [],
      deletedViaPointIds: [104],
    });
  });

  test('reports an unknown Course Mark rather than planning a delete', () => {
    expect(
      planCourseMarkDeletion({
        courseMarks: makeCourseMarks([[], []]),
        courseMarkId: 999,
      }),
    ).toEqual({ kind: 'notFound' });
  });
});
