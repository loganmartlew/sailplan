import { getNextCourseMarkOrder } from '../courseMarkOrder';

describe('getNextCourseMarkOrder', () => {
  test('appends after a Course Mark ordered zero', () => {
    expect(getNextCourseMarkOrder(0)).toBe(1);
  });
});
