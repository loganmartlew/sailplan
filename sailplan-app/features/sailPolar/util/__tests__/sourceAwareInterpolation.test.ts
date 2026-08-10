import { estimateSailSpeed } from '../interpolation';
import {
  CAPTURE_BLEND_WEIGHT,
  CAPTURE_COVERAGE_RADIUS,
  estimateSourceAwareSailSpeed,
  type SourceAwarePolarPoint,
} from '../sourceAwareInterpolation';

const target = { tws: 10, twa: 90 };

const importedGrid: SourceAwarePolarPoint[] = [
  { tws: 10, twa: 90, speed: 6, sourceKind: 'import' },
];

describe('estimateSourceAwareSailSpeed', () => {
  it('leaves non-capture data as the sole answer outside capture coverage', () => {
    const points: SourceAwarePolarPoint[] = [
      ...importedGrid,
      {
        tws: target.tws + CAPTURE_COVERAGE_RADIUS.tws + 0.1,
        twa: target.twa,
        speed: 10,
        sourceKind: 'capture',
      },
    ];

    expect(estimateSourceAwareSailSpeed(target, points)).toEqual(
      estimateSailSpeed(target, importedGrid),
    );
  });

  it('blends captured data at the exported weight inside capture coverage', () => {
    const capturedSpeed = 10;
    const result = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      { tws: 10, twa: 90, speed: capturedSpeed, sourceKind: 'capture' },
    ]);

    expect(result.predictedSpeed).toBeCloseTo(
      6 * (1 - CAPTURE_BLEND_WEIGHT) + capturedSpeed * CAPTURE_BLEND_WEIGHT,
    );
    expect(result.pointsUsed).toHaveLength(2);
  });

  it('pools captured points from separate sessions before blending', () => {
    const result = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      // These are promoted by two different capture sessions. Source kind, not
      // session, is the partition boundary, so both must inform one estimate.
      { tws: 10, twa: 90, speed: 8, sourceKind: 'capture' },
      { tws: 10, twa: 90, speed: 12, sourceKind: 'capture' },
    ]);

    expect(result.predictedSpeed).toBeCloseTo(
      6 * (1 - CAPTURE_BLEND_WEIGHT) + 10 * CAPTURE_BLEND_WEIGHT,
    );
  });

  it('exports the pending-calibration coverage constants', () => {
    expect(CAPTURE_BLEND_WEIGHT).toBe(0.5);
    expect(CAPTURE_COVERAGE_RADIUS).toEqual({ tws: 1, twa: 10 });
  });
});
