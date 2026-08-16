import { mapCourseRoute } from '../mapCourseRoute';

describe('mapCourseRoute', () => {
  test('maps a direct Course into deterministically ordered Mark-to-Mark Legs', () => {
    const route = mapCourseRoute({
      id: 42,
      courseMarks: [
        {
          id: 30,
          courseId: 42,
          markId: 3,
          order: 2,
          direction: null,
          note: null,
          mark: { id: 3, name: 'Finish', latitude: -36.9, longitude: 174.8 },
          viaPoints: [],
        },
        {
          id: 10,
          courseId: 42,
          markId: 1,
          order: 0,
          direction: 'starboard',
          note: 'Clear the committee boat',
          mark: { id: 1, name: 'Start', latitude: -36.8, longitude: 174.7 },
          viaPoints: [],
        },
        {
          id: 20,
          courseId: 42,
          markId: 2,
          order: 1,
          direction: 'port',
          note: null,
          mark: { id: 2, name: 'Windward', latitude: -36.7, longitude: 174.75 },
          viaPoints: [],
        },
      ],
    });

    expect(route.points.map(point => point.name)).toEqual([
      'Start',
      'Windward',
      'Finish',
    ]);
    expect(route.legs).toHaveLength(2);
    expect(route.legs.map(leg => leg.legId)).toEqual([10, 20]);
    expect(route.legs.map(leg => leg.segments)).toEqual([
      [
        {
          key: '10:0',
          from: route.points[0],
          to: route.points[1],
          indexInLeg: 0,
        },
      ],
      [
        {
          key: '20:0',
          from: route.points[1],
          to: route.points[2],
          indexInLeg: 0,
        },
      ],
    ]);
  });

  test('resolves local and Mark-backed Via Points in order', () => {
    const route = mapCourseRoute({
      id: 42,
      courseMarks: [
        {
          id: 10,
          courseId: 42,
          markId: 1,
          order: 0,
          direction: null,
          note: null,
          mark: { id: 1, name: 'Start', latitude: -36.8, longitude: 174.7 },
          viaPoints: [
            {
              id: 102,
              legStartCourseMarkId: 10,
              order: 0,
              markId: 9,
              name: null,
              latitude: null,
              longitude: null,
              note: 'Leave room for traffic',
              mark: { id: 9, name: 'Green pile', latitude: -36.78, longitude: 174.72 },
            },
            {
              id: 101,
              legStartCourseMarkId: 10,
              order: 0,
              markId: null,
              name: 'Reef edge',
              latitude: -36.79,
              longitude: 174.71,
              note: null,
              mark: null,
            },
          ],
        },
        {
          id: 20,
          courseId: 42,
          markId: 2,
          order: 1,
          direction: null,
          note: null,
          mark: { id: 2, name: 'Finish', latitude: -36.7, longitude: 174.75 },
          viaPoints: [],
        },
      ],
    });

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
      mapCourseRoute({
        id: 42,
        courseMarks: [
          {
            id: 10,
            courseId: 42,
            markId: 1,
            order: 0,
            direction: null,
            note: null,
            mark: { id: 1, name: 'Start', latitude: -36.8, longitude: 174.7 },
            viaPoints: [
              {
                id: 101,
                legStartCourseMarkId: 10,
                order: 0,
                markId: 9,
                name: 'Not allowed',
                latitude: -36.79,
                longitude: 174.71,
                note: null,
                mark: { id: 9, name: 'Green pile', latitude: -36.78, longitude: 174.72 },
              },
            ],
          },
        ],
      }),
    ).toThrow('Via Point 101 must be either local or Mark-backed');
  });

  test('rejects a Via Point attached to a Course Mark that cannot start a Leg', () => {
    expect(() =>
      mapCourseRoute({
        id: 42,
        courseMarks: [
          {
            id: 10,
            courseId: 42,
            markId: 1,
            order: 0,
            direction: null,
            note: null,
            mark: { id: 1, name: 'Start', latitude: -36.8, longitude: 174.7 },
            viaPoints: [],
          },
          {
            id: 20,
            courseId: 42,
            markId: 2,
            order: 1,
            direction: null,
            note: null,
            mark: { id: 2, name: 'Finish', latitude: -36.7, longitude: 174.75 },
            viaPoints: [
              {
                id: 101,
                legStartCourseMarkId: 20,
                order: 0,
                markId: null,
                name: 'Too late',
                latitude: -36.71,
                longitude: 174.74,
                note: null,
                mark: null,
              },
            ],
          },
        ],
      }),
    ).toThrow('Course Mark 20 cannot own Via Points because it does not start a Leg');
  });

  test('rejects a legacy Course Mark whose saved Mark is missing', () => {
    expect(() =>
      mapCourseRoute({
        id: 42,
        courseMarks: [
          {
            id: 10,
            courseId: 42,
            markId: 1,
            order: 0,
            direction: null,
            note: null,
            mark: null,
            viaPoints: [],
          },
        ],
      }),
    ).toThrow('Course Mark 10 has no saved Mark');
  });
});
