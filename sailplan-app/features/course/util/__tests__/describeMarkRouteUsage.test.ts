import { describeMarkRouteUsage } from '../describeMarkRouteUsage';

describe('describeMarkRouteUsage', () => {
  test('allows deletion when nothing routes through the Mark', () => {
    expect(
      describeMarkRouteUsage({
        courseMarkCount: 0,
        viaPointCount: 0,
        courseNames: [],
      }),
    ).toBeNull();
  });

  test('counts Course Marks and Via Points together and names the Courses', () => {
    expect(
      describeMarkRouteUsage({
        courseMarkCount: 1,
        viaPointCount: 2,
        courseNames: ['Harbour Race', 'Winter Series'],
      }),
    ).toBe(
      'This Mark is used by 3 route points in Harbour Race, Winter Series. Remove it from those Courses before deleting it.',
    );
  });

  test('reads singular for one usage in one Course', () => {
    expect(
      describeMarkRouteUsage({
        courseMarkCount: 1,
        viaPointCount: 0,
        courseNames: ['Harbour Race'],
      }),
    ).toBe(
      'This Mark is used by 1 route point in Harbour Race. Remove it from that Course before deleting it.',
    );
  });
});
