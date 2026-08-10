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

  it('includes captured data inside capture coverage', () => {
    const withoutCapture = estimateSourceAwareSailSpeed(target, importedGrid);
    const withCapture = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      { tws: 10, twa: 90, speed: 10, sourceKind: 'capture' },
    ]);

    expect(withCapture.predictedSpeed).toBeGreaterThan(withoutCapture.predictedSpeed);
    expect(withCapture.predictedSpeed).toBeLessThan(10);
    expect(withCapture.pointsUsed).toHaveLength(2);
  });

  it('pools captured points from separate sessions before blending', () => {
    const onlySlowerCapture = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      { tws: 10, twa: 90, speed: 8, sourceKind: 'capture' },
    ]);
    const onlyFasterCapture = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      { tws: 10, twa: 90, speed: 12, sourceKind: 'capture' },
    ]);
    const pooledCaptures = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      // These are promoted by two different capture sessions. Source kind, not
      // session, is the partition boundary, so both must inform one estimate.
      { tws: 10, twa: 90, speed: 8, sourceKind: 'capture' },
      { tws: 10, twa: 90, speed: 12, sourceKind: 'capture' },
    ]);

    expect(pooledCaptures.predictedSpeed).toBeGreaterThan(
      onlySlowerCapture.predictedSpeed,
    );
    expect(pooledCaptures.predictedSpeed).toBeLessThan(
      onlyFasterCapture.predictedSpeed,
    );
  });

  it('tapers capture influence across the outer half of its coverage', () => {
    const capturedPoint: SourceAwarePolarPoint = {
      tws: 10,
      twa: 90,
      speed: 10,
      sourceKind: 'capture',
    };
    const inner = estimateSourceAwareSailSpeed(target, [
      ...importedGrid,
      capturedPoint,
    ]);
    const outer = estimateSourceAwareSailSpeed(
      { tws: 10.75, twa: 90 },
      [...importedGrid, capturedPoint],
    );
    const atEdge = estimateSourceAwareSailSpeed(
      { tws: 11, twa: 90 },
      [...importedGrid, capturedPoint],
    );
    const nonCaptureAtEdge = estimateSourceAwareSailSpeed(
      { tws: 11, twa: 90 },
      importedGrid,
    );

    expect(outer.predictedSpeed).toBeLessThan(inner.predictedSpeed);
    expect(outer.predictedSpeed).toBeGreaterThan(
      nonCaptureAtEdge.predictedSpeed,
    );
    expect(atEdge).toEqual(nonCaptureAtEdge);
  });

  it('exports the pending-calibration coverage constants', () => {
    expect(CAPTURE_BLEND_WEIGHT).toBe(0.5);
    expect(CAPTURE_COVERAGE_RADIUS).toEqual({ tws: 1, twa: 10 });
  });
});
