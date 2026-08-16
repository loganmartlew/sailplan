import { CourseMarkRoutePoint, CourseRoute, MarkBackedViaRoutePoint } from '~/features/course';
import { buildPlanRoute } from '../planRoute';

function makeCourseMarkPoint(
  overrides: Partial<CourseMarkRoutePoint> & { courseMarkId: number },
): CourseMarkRoutePoint {
  return {
    kind: 'courseMark',
    markId: overrides.courseMarkId,
    order: 0,
    name: `Mark ${overrides.courseMarkId}`,
    latitude: -36.8,
    longitude: 174.7,
    direction: null,
    note: null,
    ...overrides,
  };
}

function makeDirectRoute(): CourseRoute {
  const start = makeCourseMarkPoint({ courseMarkId: 10, name: 'Start', order: 0 });
  const finish = makeCourseMarkPoint({
    courseMarkId: 20,
    name: 'Finish',
    order: 1,
    latitude: -36.7,
    longitude: 174.75,
  });

  return {
    courseId: 42,
    points: [start, finish],
    legs: [
      {
        legId: 10,
        index: 0,
        start,
        end: finish,
        viaPoints: [],
        segments: [{ key: '10:0', from: start, to: finish, indexInLeg: 0 }],
      },
    ],
  };
}

describe('buildPlanRoute', () => {
  test('adds custom endpoints as explicit synthetic Legs around a direct Course', () => {
    const route = buildPlanRoute({
      route: makeDirectRoute(),
      startLocation: {
        name: 'Committee boat',
        latitude: -36.81,
        longitude: 174.69,
      },
      finishLocation: {
        name: 'Finish boat',
        latitude: -36.69,
        longitude: 174.76,
      },
    });

    expect(route.legs.map(leg => [leg.legId, leg.segments[0].key])).toEqual([
      [null, 'plan-start'],
      [10, '10:0'],
      [null, 'plan-finish'],
    ]);
    expect(route.legs.map(leg => leg.index)).toEqual([0, 1, 2]);
    expect(route.points.map(point => point.name)).toEqual([
      'Committee boat',
      'Start',
      'Finish',
      'Finish boat',
    ]);
  });

  test('leaves a direct Course untouched when no endpoints are chosen', () => {
    const courseRoute = makeDirectRoute();
    const route = buildPlanRoute({
      route: courseRoute,
      startLocation: null,
      finishLocation: null,
    });

    expect(route.points).toEqual(courseRoute.points);
    expect(route.legs.map(leg => [leg.legId, leg.index])).toEqual([[10, 0]]);
    expect(route.legs.flatMap(leg => leg.segments)).toEqual(
      courseRoute.legs.flatMap(leg => leg.segments),
    );
  });

  test('numbers Legs contiguously when only a finish location is chosen', () => {
    const route = buildPlanRoute({
      route: makeDirectRoute(),
      startLocation: null,
      finishLocation: {
        name: 'Finish boat',
        latitude: -36.69,
        longitude: 174.76,
      },
    });

    expect(route.legs.map(leg => leg.index)).toEqual([0, 1]);
    expect(route.legs.at(-1)?.segments[0].key).toBe('plan-finish');
  });

  test('preserves Mark-backed Via Point endpoints as two actual Segments', () => {
    const courseRoute = makeDirectRoute();
    const via: MarkBackedViaRoutePoint = {
      kind: 'markBackedVia', viaPointId: 30, markId: 99, name: 'Channel',
      latitude: -36.75, longitude: 174.72, note: null,
    };
    courseRoute.points.splice(1, 0, via);
    courseRoute.legs[0].viaPoints = [via];
    courseRoute.legs[0].segments = [
      { key: '10:0', from: courseRoute.legs[0].start, to: via, indexInLeg: 0 },
      { key: '10:1', from: via, to: courseRoute.legs[0].end, indexInLeg: 1 },
    ];

    const route = buildPlanRoute({ route: courseRoute, startLocation: null, finishLocation: null });
    expect(route.legs[0].segments.map(segment => [segment.from.name, segment.to.name])).toEqual([
      ['Start', 'Channel'], ['Channel', 'Finish'],
    ]);
  });
});
