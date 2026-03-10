import { DEFAULT_INTERPOLATION_CONFIG } from '../../model/interpolation';
import type {
  PolarPoint,
  InterpolationConfig,
} from '../../model/interpolation';
import {
  computeDistance,
  selectNearestPoints,
  interpolateSpeed,
  computeConfidence,
  estimateSailSpeed,
} from '../interpolation';

const cfg = DEFAULT_INTERPOLATION_CONFIG;

// ---------------------------------------------------------------------------
// computeDistance
// ---------------------------------------------------------------------------
describe('computeDistance', () => {
  it('returns 0 for identical points', () => {
    expect(
      computeDistance(
        { tws: 10, twa: 90 },
        { tws: 10, twa: 90, speed: 5 },
        0.25,
      ),
    ).toBe(0);
  });

  it('computes pure TWS distance when TWA matches', () => {
    const d = computeDistance(
      { tws: 10, twa: 90 },
      { tws: 14, twa: 90, speed: 5 },
      0.25,
    );
    expect(d).toBeCloseTo(4, 5);
  });

  it('computes pure TWA distance (scaled) when TWS matches', () => {
    const d = computeDistance(
      { tws: 10, twa: 90 },
      { tws: 10, twa: 110, speed: 5 },
      0.25,
    );
    // ΔTWA = 20, scaled = 20 * 0.25 = 5
    expect(d).toBeCloseTo(5, 5);
  });

  it('computes combined distance correctly', () => {
    const d = computeDistance(
      { tws: 10, twa: 90 },
      { tws: 13, twa: 106, speed: 5 },
      0.25,
    );
    // ΔTWS = 3, ΔTWA = 16, scaled = 4  → sqrt(9+16) = 5
    expect(d).toBeCloseTo(5, 5);
  });

  it('respects twaScale parameter', () => {
    const d1 = computeDistance(
      { tws: 10, twa: 90 },
      { tws: 10, twa: 100, speed: 5 },
      0.25,
    );
    const d2 = computeDistance(
      { tws: 10, twa: 90 },
      { tws: 10, twa: 100, speed: 5 },
      0.5,
    );
    expect(d2).toBeGreaterThan(d1);
  });
});

// ---------------------------------------------------------------------------
// selectNearestPoints
// ---------------------------------------------------------------------------
describe('selectNearestPoints', () => {
  const points: PolarPoint[] = [
    { tws: 10, twa: 90, speed: 5 },
    { tws: 12, twa: 95, speed: 6 },
    { tws: 8, twa: 85, speed: 4 },
    { tws: 15, twa: 100, speed: 7 },
    { tws: 20, twa: 120, speed: 8 },
    { tws: 5, twa: 60, speed: 3 },
    { tws: 11, twa: 88, speed: 5.5 },
    { tws: 9, twa: 92, speed: 4.5 },
  ];

  it('returns up to k nearest points', () => {
    const result = selectNearestPoints({ tws: 10, twa: 90 }, points, cfg);
    expect(result.length).toBeLessThanOrEqual(cfg.k);
  });

  it('returns points sorted by distance (nearest first)', () => {
    const result = selectNearestPoints({ tws: 10, twa: 90 }, points, cfg);
    expect(result[0]).toEqual({ tws: 10, twa: 90, speed: 5 });
  });

  it('excludes points outside the search window', () => {
    const farPoints: PolarPoint[] = [
      { tws: 30, twa: 170, speed: 10 },
      { tws: 10, twa: 90, speed: 5 },
    ];
    const result = selectNearestPoints({ tws: 10, twa: 90 }, farPoints, cfg);
    expect(result).toEqual([{ tws: 10, twa: 90, speed: 5 }]);
  });

  it('returns empty array when no points in window', () => {
    const result = selectNearestPoints(
      { tws: 10, twa: 90 },
      [{ tws: 50, twa: 170, speed: 10 }],
      cfg,
    );
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(selectNearestPoints({ tws: 10, twa: 90 }, [], cfg)).toEqual([]);
  });

  it('respects maxTwsDelta boundary', () => {
    const borderPoints: PolarPoint[] = [
      { tws: 18, twa: 90, speed: 5 }, // ΔTWS = 8 → exactly on boundary
      { tws: 19, twa: 90, speed: 5 }, // ΔTWS = 9 → outside
    ];
    const result = selectNearestPoints({ tws: 10, twa: 90 }, borderPoints, cfg);
    expect(result.length).toBe(1);
    expect(result[0].tws).toBe(18);
  });

  it('respects maxTwaDelta boundary', () => {
    const borderPoints: PolarPoint[] = [
      { tws: 10, twa: 130, speed: 5 }, // ΔTWA = 40 → exactly on boundary
      { tws: 10, twa: 131, speed: 5 }, // ΔTWA = 41 → outside
    ];
    const result = selectNearestPoints({ tws: 10, twa: 90 }, borderPoints, cfg);
    expect(result.length).toBe(1);
    expect(result[0].twa).toBe(130);
  });
});

// ---------------------------------------------------------------------------
// interpolateSpeed
// ---------------------------------------------------------------------------
describe('interpolateSpeed', () => {
  it('returns 0 speed for empty points', () => {
    const result = interpolateSpeed({ tws: 10, twa: 90 }, [], cfg);
    expect(result.predictedSpeed).toBe(0);
    expect(result.pointsUsed).toEqual([]);
  });

  it('returns exact speed for a zero-distance point', () => {
    const points: PolarPoint[] = [
      { tws: 10, twa: 90, speed: 6.5 },
      { tws: 12, twa: 95, speed: 7 },
    ];
    const result = interpolateSpeed({ tws: 10, twa: 90 }, points, cfg);
    expect(result.predictedSpeed).toBe(6.5);
    expect(result.pointsUsed).toEqual([{ tws: 10, twa: 90, speed: 6.5 }]);
  });

  it('returns the single point speed when only one point given', () => {
    const result = interpolateSpeed(
      { tws: 10, twa: 90 },
      [{ tws: 12, twa: 95, speed: 7 }],
      cfg,
    );
    expect(result.predictedSpeed).toBe(7);
  });

  it('returns average speed for equidistant points', () => {
    // Two points equidistant from target should average their speeds
    const points: PolarPoint[] = [
      { tws: 12, twa: 90, speed: 4 }, // ΔTWS = +2
      { tws: 8, twa: 90, speed: 8 }, // ΔTWS = -2
    ];
    const result = interpolateSpeed({ tws: 10, twa: 90 }, points, cfg);
    expect(result.predictedSpeed).toBeCloseTo(6, 5);
  });

  it('weights closer points more heavily', () => {
    const points: PolarPoint[] = [
      { tws: 11, twa: 90, speed: 10 }, // very close, dist = 1
      { tws: 18, twa: 90, speed: 2 }, // far, dist = 8
    ];
    const result = interpolateSpeed({ tws: 10, twa: 90 }, points, cfg);
    // Closer point (speed=10) should dominate
    expect(result.predictedSpeed).toBeGreaterThan(8);
  });

  it('produces a known IDW result', () => {
    // Points at distances 2 and 4 from target, p=2
    // w1 = 1/4 = 0.25, w2 = 1/16 = 0.0625
    // predicted = (5*0.25 + 9*0.0625) / (0.25 + 0.0625) = (1.25 + 0.5625) / 0.3125 = 5.8
    const points: PolarPoint[] = [
      { tws: 12, twa: 90, speed: 5 }, // dist = 2
      { tws: 14, twa: 90, speed: 9 }, // dist = 4
    ];
    const result = interpolateSpeed({ tws: 10, twa: 90 }, points, cfg);
    expect(result.predictedSpeed).toBeCloseTo(5.8, 1);
  });
});

// ---------------------------------------------------------------------------
// computeConfidence
// ---------------------------------------------------------------------------
describe('computeConfidence', () => {
  it('returns 0 for empty nearest points', () => {
    expect(computeConfidence({ tws: 10, twa: 90 }, [], [], cfg)).toBe(0);
  });

  it('returns high confidence when many close bracketing points exist', () => {
    const points: PolarPoint[] = [
      { tws: 9, twa: 85, speed: 5 },
      { tws: 11, twa: 95, speed: 6 },
      { tws: 9, twa: 95, speed: 5 },
      { tws: 11, twa: 85, speed: 6 },
      { tws: 10, twa: 88, speed: 5.5 },
      { tws: 10, twa: 92, speed: 5.5 },
    ];
    const c = computeConfidence({ tws: 10, twa: 90 }, points, points, cfg);
    expect(c).toBeGreaterThanOrEqual(0.6);
  });

  it('returns lower confidence for sparse distant points', () => {
    const points: PolarPoint[] = [{ tws: 17, twa: 125, speed: 5 }];
    const c = computeConfidence({ tws: 10, twa: 90 }, points, points, cfg);
    expect(c).toBeLessThan(0.5);
  });

  it('gives full coverage score when points bracket in both dimensions', () => {
    const points: PolarPoint[] = [
      { tws: 8, twa: 80, speed: 4 },
      { tws: 12, twa: 100, speed: 6 },
    ];
    const c = computeConfidence({ tws: 10, twa: 90 }, points, points, cfg);
    // Coverage should be 1.0 (bracketed both axes)
    // Check it's higher than partial bracket
    const partialPoints: PolarPoint[] = [
      { tws: 12, twa: 100, speed: 6 },
      { tws: 14, twa: 110, speed: 7 },
    ];
    const cPartial = computeConfidence(
      { tws: 10, twa: 90 },
      partialPoints,
      partialPoints,
      cfg,
    );
    expect(c).toBeGreaterThan(cPartial);
  });

  it('gives 0 coverage when no bracketing', () => {
    // All points above target in both dimensions
    const points: PolarPoint[] = [
      { tws: 12, twa: 100, speed: 6 },
      { tws: 14, twa: 110, speed: 7 },
    ];
    const c1 = computeConfidence({ tws: 10, twa: 90 }, points, points, cfg);
    // All points below target in both dimensions
    const pointsBelow: PolarPoint[] = [
      { tws: 8, twa: 80, speed: 4 },
      { tws: 6, twa: 70, speed: 3 },
    ];
    const c2 = computeConfidence(
      { tws: 10, twa: 90 },
      pointsBelow,
      pointsBelow,
      cfg,
    );
    // Both should have 0 coverage → lower confidence than bracketed
    const bracketed: PolarPoint[] = [
      { tws: 8, twa: 80, speed: 4 },
      { tws: 12, twa: 100, speed: 6 },
    ];
    const c3 = computeConfidence(
      { tws: 10, twa: 90 },
      bracketed,
      bracketed,
      cfg,
    );
    expect(c3).toBeGreaterThan(c1);
    expect(c3).toBeGreaterThan(c2);
  });

  it('higher point count in window increases confidence', () => {
    const nearest: PolarPoint[] = [
      { tws: 9, twa: 85, speed: 5 },
      { tws: 11, twa: 95, speed: 6 },
    ];
    const moreInWindow: PolarPoint[] = [
      ...nearest,
      { tws: 10, twa: 88, speed: 5.2 },
      { tws: 10, twa: 92, speed: 5.8 },
      { tws: 9, twa: 95, speed: 5.1 },
      { tws: 11, twa: 85, speed: 5.9 },
    ];
    const cFew = computeConfidence({ tws: 10, twa: 90 }, nearest, nearest, cfg);
    const cMany = computeConfidence(
      { tws: 10, twa: 90 },
      nearest,
      moreInWindow,
      cfg,
    );
    expect(cMany).toBeGreaterThan(cFew);
  });
});

// ---------------------------------------------------------------------------
// estimateSailSpeed (integration)
// ---------------------------------------------------------------------------
describe('estimateSailSpeed', () => {
  it('returns zero result for empty polars', () => {
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, []);
    expect(result.predictedSpeed).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.pointsUsed).toEqual([]);
  });

  it('returns exact speed when target matches a polar point', () => {
    const points: PolarPoint[] = [
      { tws: 10, twa: 90, speed: 6.2 },
      { tws: 12, twa: 100, speed: 7 },
      { tws: 8, twa: 80, speed: 5 },
    ];
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, points);
    expect(result.predictedSpeed).toBe(6.2);
  });

  it('interpolates between nearby points', () => {
    const points: PolarPoint[] = [
      { tws: 8, twa: 80, speed: 4 },
      { tws: 12, twa: 80, speed: 6 },
      { tws: 8, twa: 100, speed: 5 },
      { tws: 12, twa: 100, speed: 7 },
    ];
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, points);
    // All equidistant → should average to 5.5
    expect(result.predictedSpeed).toBeCloseTo(5.5, 1);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('handles single polar point', () => {
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, [
      { tws: 12, twa: 95, speed: 6 },
    ]);
    expect(result.predictedSpeed).toBe(6);
    expect(result.pointsUsed.length).toBe(1);
  });

  it('ignores far-away points and returns low confidence', () => {
    const points: PolarPoint[] = [{ tws: 30, twa: 170, speed: 10 }];
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, points);
    expect(result.predictedSpeed).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('produces high confidence for a dense grid', () => {
    const points: PolarPoint[] = [];
    for (let tws = 6; tws <= 14; tws += 2) {
      for (let twa = 70; twa <= 110; twa += 10) {
        points.push({ tws, twa, speed: tws * 0.5 + twa * 0.02 });
      }
    }
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, points);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.pointsUsed.length).toBeGreaterThan(0);
  });

  it('produces low confidence for a single distant point', () => {
    const result = estimateSailSpeed({ tws: 10, twa: 90 }, [
      { tws: 17, twa: 125, speed: 5 },
    ]);
    expect(result.confidence).toBeLessThan(0.3);
  });

  it('accepts partial config overrides', () => {
    const points: PolarPoint[] = [
      { tws: 10, twa: 90, speed: 5 },
      { tws: 12, twa: 95, speed: 6 },
      { tws: 14, twa: 100, speed: 7 },
    ];
    const resultK1 = estimateSailSpeed({ tws: 11, twa: 92 }, points, { k: 1 });
    expect(resultK1.pointsUsed.length).toBeLessThanOrEqual(1);
  });

  it('returns reasonable speed for a realistic sparse dataset', () => {
    const points: PolarPoint[] = [
      { tws: 6, twa: 60, speed: 3.2 },
      { tws: 8, twa: 75, speed: 4.5 },
      { tws: 10, twa: 90, speed: 5.8 },
      { tws: 10, twa: 120, speed: 5.1 },
      { tws: 12, twa: 90, speed: 6.5 },
      { tws: 12, twa: 135, speed: 5.9 },
      { tws: 15, twa: 60, speed: 6.0 },
      { tws: 15, twa: 110, speed: 7.2 },
      { tws: 15, twa: 150, speed: 6.8 },
      { tws: 20, twa: 90, speed: 7.5 },
      { tws: 20, twa: 140, speed: 8.0 },
    ];
    const result = estimateSailSpeed({ tws: 11, twa: 95 }, points);
    expect(result.predictedSpeed).toBeGreaterThan(4);
    expect(result.predictedSpeed).toBeLessThan(8);
    expect(result.confidence).toBeGreaterThan(0.3);
  });
});
