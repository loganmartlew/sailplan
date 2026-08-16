import { CourseMarkWithRouteData } from '../../model/courseMark';
import { CourseViaPointWithMark } from '../../model/courseViaPoint';
import { CourseRouteRow, mapCourseRoute } from '../mapCourseRoute';

const COURSE_ID = 42;

function makeCourseMarkRow(
  overrides: Partial<CourseMarkWithRouteData> & { id: number; order: number },
): CourseMarkWithRouteData {
  const markId = overrides.markId ?? overrides.id / 10;
  return {
    courseId: COURSE_ID,
    markId,
    direction: null,
    note: null,
    mark: {
      id: markId,
      name: `Mark ${markId}`,
      latitude: -36.8,
      longitude: 174.7,
    },
    viaPoints: [],
    ...overrides,
  };
}

function makeLocalViaPointRow(
  overrides: Partial<CourseViaPointWithMark> & {
    id: number;
    legStartCourseMarkId: number;
    order: number;
  },
): CourseViaPointWithMark {
  return {
    markId: null,
    name: `Via ${overrides.id}`,
    latitude: -36.79,
    longitude: 174.71,
    note: null,
    mark: null,
    ...overrides,
  };
}

function makeMarkBackedViaPointRow(
  overrides: Partial<CourseViaPointWithMark> & {
    id: number;
    legStartCourseMarkId: number;
    order: number;
    markId: number;
  },
): CourseViaPointWithMark {
  return {
    name: null,
    latitude: null,
    longitude: null,
    note: null,
    mark: {
      id: overrides.markId,
      name: `Mark ${overrides.markId}`,
      latitude: -36.78,
      longitude: 174.72,
    },
    ...overrides,
  };
}

function makeCourseRouteRow(
  courseMarks: CourseMarkWithRouteData[],
): CourseRouteRow {
  return { id: COURSE_ID, courseMarks };
}

describe('mapCourseRoute', () => {
  test('maps a direct Course into deterministically ordered Mark-to-Mark Legs', () => {
    const route = mapCourseRoute(
      makeCourseRouteRow([
        makeCourseMarkRow({ id: 30, order: 2, mark: mark(3, 'Finish') }),
        makeCourseMarkRow({
          id: 10,
          order: 0,
          direction: 'starboard',
          note: 'Clear the committee boat',
          mark: mark(1, 'Start'),
        }),
        makeCourseMarkRow({ id: 20, order: 1, direction: 'port', mark: mark(2, 'Windward') }),
      ]),
    );

    expect(route.points.map(point => point.name)).toEqual([
      'Start',
      'Windward',
      'Finish',
    ]);
    expect(route.legs).toHaveLength(2);
    expect(route.legs.map(leg => leg.legId)).toEqual([10, 20]);
    expect(route.legs.map(leg => leg.segments)).toEqual([
      [{ key: '10:0', from: route.points[0], to: route.points[1], indexInLeg: 0 }],
      [{ key: '20:0', from: route.points[1], to: route.points[2], indexInLeg: 0 }],
    ]);
  });

  test('carries the persisted Course Mark order onto the route point', () => {
    const route = mapCourseRoute(
      makeCourseRouteRow([
        makeCourseMarkRow({
          id: 10,
          order: 0,
          viaPoints: [
            makeLocalViaPointRow({ id: 101, legStartCourseMarkId: 10, order: 0 }),
          ],
        }),
        makeCourseMarkRow({ id: 20, order: 1 }),
      ]),
    );

    // The Via Point sits between the two Course Marks, so route position and
    // persisted order deliberately diverge.
    expect(route.points.map(point => point.kind)).toEqual([
      'courseMark',
      'localVia',
      'courseMark',
    ]);
    expect(
      route.points.flatMap(point =>
        point.kind === 'courseMark' ? [point.order] : [],
      ),
    ).toEqual([0, 1]);
  });

  test('breaks ties on equal order by row id', () => {
    const route = mapCourseRoute(
      makeCourseRouteRow([
        makeCourseMarkRow({ id: 20, order: 0, mark: mark(2, 'Second') }),
        makeCourseMarkRow({ id: 10, order: 0, mark: mark(1, 'First') }),
      ]),
    );

    expect(route.points.map(point => point.name)).toEqual(['First', 'Second']);
  });

  test('resolves local and Mark-backed Via Points in order', () => {
    const route = mapCourseRoute(
      makeCourseRouteRow([
        makeCourseMarkRow({
          id: 10,
          order: 0,
          mark: mark(1, 'Start'),
          viaPoints: [
            makeMarkBackedViaPointRow({
              id: 102,
              legStartCourseMarkId: 10,
              order: 1,
              markId: 9,
              mark: mark(9, 'Green pile'),
              note: 'Leave room for traffic',
            }),
            makeLocalViaPointRow({
              id: 101,
              legStartCourseMarkId: 10,
              order: 0,
              name: 'Reef edge',
            }),
          ],
        }),
        makeCourseMarkRow({ id: 20, order: 1, mark: mark(2, 'Finish') }),
      ]),
    );

    expect(route.points.map(point => point.kind)).toEqual([
      'courseMark',
      'localVia',
      'markBackedVia',
      'courseMark',
    ]);
    expect(route.points.map(point => point.name)).toEqual([
      'Start',
      'Reef edge',
      'Green pile',
      'Finish',
    ]);
    expect(route.legs[0].segments.map(segment => segment.key)).toEqual([
      '10:0',
      '10:1',
      '10:2',
    ]);
  });

  test('rejects a Via Point that mixes local coordinates with a Mark reference', () => {
    expect(() =>
      mapCourseRoute(
        makeCourseRouteRow([
          makeCourseMarkRow({
            id: 10,
            order: 0,
            viaPoints: [
              makeLocalViaPointRow({
                id: 101,
                legStartCourseMarkId: 10,
                order: 0,
                markId: 9,
                mark: mark(9, 'Green pile'),
              }),
            ],
          }),
        ]),
      ),
    ).toThrow('Via Point 101 must be either local or Mark-backed');
  });

  test('rejects a Via Point attached to a Course Mark that cannot start a Leg', () => {
    expect(() =>
      mapCourseRoute(
        makeCourseRouteRow([
          makeCourseMarkRow({ id: 10, order: 0 }),
          makeCourseMarkRow({
            id: 20,
            order: 1,
            viaPoints: [
              makeLocalViaPointRow({ id: 101, legStartCourseMarkId: 20, order: 0 }),
            ],
          }),
        ]),
      ),
    ).toThrow(
      'Course Mark 20 cannot own Via Points because it does not start a Leg',
    );
  });

  test('rejects a legacy Course Mark whose saved Mark is missing', () => {
    expect(() =>
      mapCourseRoute(
        makeCourseRouteRow([makeCourseMarkRow({ id: 10, order: 0, mark: null })]),
      ),
    ).toThrow('Course Mark 10 has no saved Mark');
  });
});

function mark(id: number, name: string) {
  return { id, name, latitude: -36.8 + id / 100, longitude: 174.7 + id / 100 };
}
