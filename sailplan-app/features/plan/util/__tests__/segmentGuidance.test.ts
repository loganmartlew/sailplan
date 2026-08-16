import { PlanRouteSegment } from '../planRoute';
import { calculateSegmentGuidance } from '../segmentGuidance';

function segment(key: string, from: [number, number], to: [number, number]): PlanRouteSegment {
  return {
    key,
    indexInLeg: 0,
    from: { kind: 'planEndpoint', name: 'From', latitude: from[0], longitude: from[1] },
    to: { kind: 'planEndpoint', name: 'To', latitude: to[0], longitude: to[1] },
  };
}

describe('calculateSegmentGuidance', () => {
  test('calculates each Via Point-created Segment from its own endpoints', () => {
    const first = calculateSegmentGuidance(segment('first', [0, 0], [0, 1]), 0);
    const second = calculateSegmentGuidance(segment('second', [0, 1], [1, 1]), 0);

    expect(first.bearing).toBeCloseTo(90);
    expect(first.twa).toEqual({ angle: 90, tack: 'port' });
    expect(second.bearing).toBeCloseTo(0);
    expect(second.twa).toEqual({ angle: 0, tack: null });
  });
});
