import { eligibleViaPointMarks } from '../eligibleViaPointMarks';

describe('eligibleViaPointMarks', () => {
  test('excludes only the bounding Course Marks and retains repeated uses', () => {
    const marks = [1, 2, 3, 4].map(id => ({ id, name: `Mark ${id}` }));
    expect(eligibleViaPointMarks(marks, { startMarkId: 1, endMarkId: 3 })).toEqual([
      marks[1],
      marks[3],
    ]);
  });
});
