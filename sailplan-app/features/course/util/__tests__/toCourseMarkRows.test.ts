import { CourseRoute } from '../../model/courseRoute';
import { toCourseMarkRows } from '../toCourseMarkRows';

const start: CourseRoute['points'][number] = {
  kind: 'courseMark',
  courseMarkId: 10,
  markId: 1,
  order: 0,
  name: 'Start',
  latitude: -36.8,
  longitude: 174.7,
  direction: 'port',
  note: null,
};

const via: CourseRoute['points'][number] = {
  kind: 'localVia',
  viaPointId: 101,
  name: 'Reef edge',
  latitude: -36.79,
  longitude: 174.71,
  note: null,
};

const finish: CourseRoute['points'][number] = {
  kind: 'courseMark',
  courseMarkId: 20,
  markId: 2,
  order: 1,
  name: 'Finish',
  latitude: -36.7,
  longitude: 174.75,
  direction: null,
  note: null,
};

describe('toCourseMarkRows', () => {
  test('keeps the persisted order rather than the position among route points', () => {
    const rows = toCourseMarkRows({
      courseId: 42,
      points: [start, via, finish],
      legs: [],
    });

    expect(rows.map(row => [row.id, row.order])).toEqual([
      [10, 0],
      [20, 1],
    ]);
    expect(rows.every(row => row.courseId === 42)).toBe(true);
    expect(rows[0].mark).toEqual({
      id: 1,
      name: 'Start',
      latitude: -36.8,
      longitude: 174.7,
    });
  });
});
