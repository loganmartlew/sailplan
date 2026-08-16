import { CourseRoute } from '~/features/course';
import { buildPlanRoute } from '../planRoute';

const directRoute: CourseRoute = {
  courseId: 42,
  points: [
    {
      kind: 'courseMark',
      courseMarkId: 10,
      markId: 1,
      name: 'Start',
      latitude: -36.8,
      longitude: 174.7,
      direction: null,
      note: null,
    },
    {
      kind: 'courseMark',
      courseMarkId: 20,
      markId: 2,
      name: 'Finish',
      latitude: -36.7,
      longitude: 174.75,
      direction: null,
      note: null,
    },
  ],
  legs: [
    {
      legId: 10,
      index: 0,
      start: {
        kind: 'courseMark',
        courseMarkId: 10,
        markId: 1,
        name: 'Start',
        latitude: -36.8,
        longitude: 174.7,
        direction: null,
        note: null,
      },
      end: {
        kind: 'courseMark',
        courseMarkId: 20,
        markId: 2,
        name: 'Finish',
        latitude: -36.7,
        longitude: 174.75,
        direction: null,
        note: null,
      },
      viaPoints: [],
      segments: [
        {
          key: '10:0',
          from: {
            kind: 'courseMark',
            courseMarkId: 10,
            markId: 1,
            name: 'Start',
            latitude: -36.8,
            longitude: 174.7,
            direction: null,
            note: null,
          },
          to: {
            kind: 'courseMark',
            courseMarkId: 20,
            markId: 2,
            name: 'Finish',
            latitude: -36.7,
            longitude: 174.75,
            direction: null,
            note: null,
          },
          indexInLeg: 0,
        },
      ],
    },
  ],
};

describe('buildPlanRoute', () => {
  test('adds custom endpoints as explicit synthetic Legs around a direct Course', () => {
    const route = buildPlanRoute({
      route: directRoute,
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
  });
});
