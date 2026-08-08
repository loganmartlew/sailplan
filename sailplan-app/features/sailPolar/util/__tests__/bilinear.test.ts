import type { PolarPoint } from '../../model/interpolation';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../model/interpolation';
import { estimateSailSpeed } from '../interpolation';
import {
  buildPolarGrid,
  buildClusteredPolarGrid,
  bracketAxis,
  medianAxisGap,
} from '../polarGrid';

/**
 * Covers the bilinear grid path and the `'auto'` strategy's IDW fallback.
 * The IDW path itself is pinned in `interpolation.test.ts`.
 */

/** Builds a dense polar grid (TWS columns × TWA rows). */
function makeGrid(
  twsValues: number[],
  twaValues: number[],
  speedFn: (tws: number, twa: number) => number,
): PolarPoint[] {
  const points: PolarPoint[] = [];
  for (const tws of twsValues) {
    for (const twa of twaValues) {
      points.push({ tws, twa, speed: speedFn(tws, twa) });
    }
  }
  return points;
}

// A linear speed surface: bilinear interpolation must recover it exactly.
const linear = (tws: number, twa: number) => 0.5 * tws + 0.05 * twa;
const GRID = makeGrid([8, 10, 12, 14], [60, 80, 100, 120], linear);

// ---------------------------------------------------------------------------
// polarGrid primitives
// ---------------------------------------------------------------------------
describe('buildPolarGrid', () => {
  it('groups by TWS and sorts columns and rows', () => {
    const shuffled: PolarPoint[] = [
      { tws: 12, twa: 100, speed: 3 },
      { tws: 8, twa: 120, speed: 1 },
      { tws: 12, twa: 60, speed: 2 },
      { tws: 8, twa: 80, speed: 0 },
    ];
    const grid = buildPolarGrid(shuffled);
    expect(grid.twsColumns).toEqual([8, 12]);
    expect(grid.byTws.get(8)!.map(r => r.twa)).toEqual([80, 120]);
    expect(grid.byTws.get(12)!.map(r => r.twa)).toEqual([60, 100]);
  });
});

describe('bracketAxis', () => {
  const axis = [6, 10, 14, 20];

  it('returns null for an empty axis', () => {
    expect(bracketAxis([], 10)).toBeNull();
  });

  it('finds exact grid lines', () => {
    expect(bracketAxis(axis, 14)).toEqual({ kind: 'exact', index: 2 });
    expect(bracketAxis(axis, 6)).toEqual({ kind: 'exact', index: 0 });
    expect(bracketAxis(axis, 20)).toEqual({ kind: 'exact', index: 3 });
  });

  it('brackets interior targets', () => {
    expect(bracketAxis(axis, 12)).toEqual({
      kind: 'inside',
      loIndex: 1,
      hiIndex: 2,
    });
  });

  it('reports below/above with distance to the nearest end', () => {
    expect(bracketAxis(axis, 4)).toEqual({
      kind: 'below',
      index: 0,
      distance: 2,
    });
    expect(bracketAxis(axis, 25)).toEqual({
      kind: 'above',
      index: 3,
      distance: 5,
    });
  });
});

describe('medianAxisGap', () => {
  it('returns null for fewer than two lines', () => {
    expect(medianAxisGap([])).toBeNull();
    expect(medianAxisGap([10])).toBeNull();
  });

  it('returns the median gap (odd and even counts)', () => {
    expect(medianAxisGap([0, 10, 20, 60])).toBe(10); // gaps 10,10,40 → 10
    expect(medianAxisGap([0, 10, 40])).toBe(20); // gaps 10,30 → 20
  });
});

// ---------------------------------------------------------------------------
// Noise-tolerant clustered grid (Package G)
// ---------------------------------------------------------------------------
describe('buildClusteredPolarGrid', () => {
  const cfg = DEFAULT_INTERPOLATION_CONFIG;

  it('reduces to the exact grid on clean data (each TWS its own column)', () => {
    const clustered = buildClusteredPolarGrid(GRID, cfg);
    const exact = buildPolarGrid(GRID);
    expect(clustered.twsColumns).toEqual(exact.twsColumns);
    for (const tws of exact.twsColumns) {
      expect(clustered.byTws.get(tws)).toEqual(exact.byTws.get(tws));
    }
  });

  it('clusters TWS scatter into one column at the cluster mean', () => {
    // Three logged samples of the "8 kn" node, none sharing an exact TWS.
    const points: PolarPoint[] = [
      { tws: 7.8, twa: 90, speed: 6.0 },
      { tws: 8.0, twa: 90, speed: 6.2 },
      { tws: 8.3, twa: 90, speed: 6.4 },
    ];
    const grid = buildClusteredPolarGrid(points, cfg);
    expect(grid.twsColumns).toHaveLength(1);
    expect(grid.twsColumns[0]).toBeCloseTo((7.8 + 8.0 + 8.3) / 3, 10);
    // One TWA bin → one row carrying the median speed (robust to the outlier).
    const rows = grid.byTws.get(grid.twsColumns[0])!;
    expect(rows).toHaveLength(1);
    expect(rows[0].speed).toBe(6.2);
  });

  it('starts a new column when the TWS gap exceeds the tolerance', () => {
    const points: PolarPoint[] = [
      { tws: 8.0, twa: 90, speed: 6 },
      { tws: 8.4, twa: 90, speed: 6 }, // gap 0.4 ≤ 1 → same column
      { tws: 10.0, twa: 90, speed: 7 }, // gap 1.6 > 1 → new column
    ];
    const grid = buildClusteredPolarGrid(points, cfg);
    expect(grid.twsColumns).toHaveLength(2);
    expect(grid.twsColumns[0]).toBeCloseTo(8.2, 10);
    expect(grid.twsColumns[1]).toBe(10);
  });

  it('bins TWA within a column and takes the median speed per bin', () => {
    // Two well-separated TWA nodes (~88°, ~108°), three noisy samples each,
    // in one TWS cluster. Each node's samples fall inside a single 4° bin.
    const points: PolarPoint[] = [
      { tws: 8.0, twa: 87, speed: 5.0 },
      { tws: 8.1, twa: 88, speed: 6.0 },
      { tws: 7.9, twa: 89, speed: 5.5 },
      { tws: 8.0, twa: 107, speed: 7.0 },
      { tws: 8.2, twa: 108, speed: 8.0 },
      { tws: 7.8, twa: 109, speed: 7.5 },
    ];
    const grid = buildClusteredPolarGrid(points, cfg);
    const rows = grid.byTws.get(grid.twsColumns[0])!;
    expect(rows.map(r => Math.round(r.twa))).toEqual([88, 108]);
    expect(rows[0].speed).toBe(5.5); // median(5.0, 6.0, 5.5)
    expect(rows[1].speed).toBe(7.5); // median(7.0, 8.0, 7.5)
  });

  it('returns an empty grid for no points', () => {
    expect(buildClusteredPolarGrid([], cfg)).toEqual({
      twsColumns: [],
      byTws: new Map(),
    });
  });
});

// ---------------------------------------------------------------------------
// Bilinear evaluation (strategy 'auto' on gridded data)
// ---------------------------------------------------------------------------
describe('estimateSailSpeed — bilinear on a regular grid', () => {
  it('recovers the exact stored speed at a grid node, confidence 1.0', () => {
    const result = estimateSailSpeed({ tws: 10, twa: 80 }, GRID);
    expect(result.predictedSpeed).toBe(linear(10, 80));
    expect(result.confidence).toBe(1);
    expect(result.pointsUsed).toEqual([
      { tws: 10, twa: 80, speed: linear(10, 80) },
    ]);
  });

  it('returns the mean of the 4 corners at a cell midpoint', () => {
    const corners = [linear(10, 80), linear(10, 100), linear(12, 80), linear(12, 100)];
    const mean = corners.reduce((a, b) => a + b) / 4;
    const result = estimateSailSpeed({ tws: 11, twa: 90 }, GRID);
    expect(result.predictedSpeed).toBeCloseTo(mean, 10);
    expect(result.confidence).toBe(1);
  });

  it('is linear along the TWA axis (no IDW plateau at data points)', () => {
    for (const twa of [80, 84, 88, 92, 96, 100]) {
      const result = estimateSailSpeed({ tws: 10, twa }, GRID);
      expect(result.predictedSpeed).toBeCloseTo(linear(10, twa), 10);
    }
  });

  it('is linear along the TWS axis between columns', () => {
    for (const tws of [10, 10.5, 11, 11.5, 12]) {
      const result = estimateSailSpeed({ tws, twa: 80 }, GRID);
      expect(result.predictedSpeed).toBeCloseTo(linear(tws, 80), 10);
    }
  });

  it('reports the consulted grid nodes in pointsUsed', () => {
    const result = estimateSailSpeed({ tws: 11, twa: 90 }, GRID);
    const used = result.pointsUsed
      .map(p => [p.tws, p.twa])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(used).toEqual([
      [10, 80],
      [10, 100],
      [12, 80],
      [12, 100],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Clamping at the grid's edge
// ---------------------------------------------------------------------------
describe('estimateSailSpeed — edge clamping', () => {
  it('clamps TWS just past the last column to 1-D TWA interpolation with reduced confidence', () => {
    // 2 kn past the 14 kn column, within maxTwsDelta 8 → twsFactor 0.75.
    const result = estimateSailSpeed({ tws: 16, twa: 90 }, GRID);
    expect(result.predictedSpeed).toBeCloseTo(linear(14, 90), 10);
    expect(result.confidence).toBeCloseTo(0.75, 10);
    // Only the clamped column's bracketing rows were consulted.
    expect(result.pointsUsed.every(p => p.tws === 14)).toBe(true);
    expect(result.pointsUsed).toHaveLength(2);
  });

  it('clamps TWA just past the last row with reduced confidence', () => {
    // 10° past the 120° row, within maxTwaDelta 40 → twaFactor 0.75.
    const result = estimateSailSpeed({ tws: 10, twa: 130 }, GRID);
    expect(result.predictedSpeed).toBe(linear(10, 120));
    expect(result.confidence).toBeCloseTo(0.75, 10);
  });

  it('penalises unusually wide TWA brackets via the gap factor', () => {
    // Rows 80,90,100,120 → median gap 10; target inside the 100–120 bracket
    // (gap 20 ≤ maxTwaGap) → twaGapFactor 0.5.
    const wide = makeGrid([10, 12], [80, 90, 100, 120], linear);
    const result = estimateSailSpeed({ tws: 11, twa: 110 }, wide);
    expect(result.predictedSpeed).toBeCloseTo(linear(11, 110), 10);
    expect(result.confidence).toBeCloseTo(0.5, 10);
  });
});

// ---------------------------------------------------------------------------
// Fallback to IDW (strategy 'auto')
// ---------------------------------------------------------------------------
describe("estimateSailSpeed — 'auto' falls back to IDW", () => {
  it('falls back when the TWS bracketing gap exceeds maxTwsGap', () => {
    // Columns 6 and 16 kn: gap 10 > maxTwsGap 8.
    const sparseColumns = makeGrid([6, 16], [80, 100], linear);
    const target = { tws: 11, twa: 90 };
    const auto = estimateSailSpeed(target, sparseColumns);
    const idw = estimateSailSpeed(target, sparseColumns, { strategy: 'idw' });
    expect(auto).toEqual(idw);
  });

  it('falls back when the TWA bracketing gap exceeds maxTwaGap', () => {
    // Rows 60 and 100°: gap 40 > maxTwaGap 20.
    const sparseRows = makeGrid([10, 12], [60, 100], linear);
    const target = { tws: 11, twa: 80 };
    const auto = estimateSailSpeed(target, sparseRows);
    const idw = estimateSailSpeed(target, sparseRows, { strategy: 'idw' });
    expect(auto).toEqual(idw);
  });

  it('falls back when a bracketing column is ragged (missing the TWA range)', () => {
    const ragged: PolarPoint[] = [
      ...makeGrid([10], [60, 80, 100, 120], linear),
      // Column 12 lacks rows around the target's 90°: bracket gap 60 > 20.
      { tws: 12, twa: 60, speed: linear(12, 60) },
      { tws: 12, twa: 120, speed: linear(12, 120) },
    ];
    const target = { tws: 11, twa: 90 };
    const auto = estimateSailSpeed(target, ragged);
    const idw = estimateSailSpeed(target, ragged, { strategy: 'idw' });
    expect(auto).toEqual(idw);
  });

  it('revives the bilinear path on a noisy grid (Package G / R2.1)', () => {
    // A regular grid buried in logged-instrument noise: every point gets a
    // unique TWS (±0.3 kn) and jittered TWA (±2°), so exact-TWS grouping yields
    // only single-row columns and the pre-G engine fell back to IDW every time.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const jitter = (amp: number) => (rand() * 2 - 1) * amp;
    const noisy: PolarPoint[] = [];
    for (const tws of [8, 10, 12, 14]) {
      for (const twa of [80, 90, 100, 110]) {
        for (let s = 0; s < 3; s++) {
          noisy.push({
            tws: tws + jitter(0.3),
            twa: twa + jitter(2),
            speed: linear(tws, twa) * (1 + jitter(0.05)),
          });
        }
      }
    }
    // Exact grouping cannot form a usable column: every TWS is unique.
    expect(
      [...buildPolarGrid(noisy).byTws.values()].every(c => c.length < 2),
    ).toBe(true);

    const target = { tws: 11, twa: 95 };
    const auto = estimateSailSpeed(target, noisy);
    const idw = estimateSailSpeed(target, noisy, { strategy: 'idw' });
    // The clustered grid served it — a different (and better-bracketed) answer
    // than IDW, with real confidence.
    expect(auto).not.toEqual(idw);
    expect(auto.confidence).toBeGreaterThan(0);
    expect(auto.predictedSpeed).toBeCloseTo(linear(11, 95), 0);
  });

  it('behaves identically to IDW on a scattered point cloud', () => {
    // No two points share a TWS value → no usable grid columns.
    const scattered: PolarPoint[] = [
      { tws: 8.1, twa: 60, speed: 4.4 },
      { tws: 9.3, twa: 72, speed: 5.1 },
      { tws: 10.7, twa: 95, speed: 6.0 },
      { tws: 11.2, twa: 88, speed: 6.2 },
      { tws: 12.8, twa: 103, speed: 6.9 },
    ];
    for (const target of [
      { tws: 10.5, twa: 85 },
      { tws: 9, twa: 70 },
      { tws: 12, twa: 100 },
    ]) {
      const auto = estimateSailSpeed(target, scattered);
      const idw = estimateSailSpeed(target, scattered, { strategy: 'idw' });
      expect(auto).toEqual(idw);
    }
  });

  it('falls back when the target sits too far outside the grid', () => {
    // 10 kn past the last column > maxTwsDelta 8.
    const target = { tws: 24, twa: 90 };
    const auto = estimateSailSpeed(target, GRID);
    const idw = estimateSailSpeed(target, GRID, { strategy: 'idw' });
    expect(auto).toEqual(idw);
  });
});

// ---------------------------------------------------------------------------
// Forced strategies
// ---------------------------------------------------------------------------
describe('estimateSailSpeed — forced strategies', () => {
  it("'bilinear' returns a zero result when the grid attempt fails", () => {
    const scattered: PolarPoint[] = [
      { tws: 9.3, twa: 72, speed: 5.1 },
      { tws: 11.2, twa: 88, speed: 6.2 },
    ];
    const result = estimateSailSpeed({ tws: 10, twa: 80 }, scattered, {
      strategy: 'bilinear',
    });
    expect(result).toEqual({ predictedSpeed: 0, confidence: 0, pointsUsed: [] });
  });

  it("'idw' ignores grid structure entirely", () => {
    // On a grid node, IDW still returns the exact speed (zero distance)…
    const atNode = estimateSailSpeed({ tws: 10, twa: 80 }, GRID, {
      strategy: 'idw',
    });
    expect(atNode.predictedSpeed).toBe(linear(10, 80));
    // …but off-centre between nodes it flattens toward the nearest node
    // (plateau behaviour) instead of following the linear surface.
    const between = estimateSailSpeed({ tws: 10, twa: 85 }, GRID, {
      strategy: 'idw',
    });
    const bilinear = estimateSailSpeed({ tws: 10, twa: 85 }, GRID);
    expect(bilinear.predictedSpeed).toBeCloseTo(linear(10, 85), 10);
    expect(between.predictedSpeed).not.toBeCloseTo(bilinear.predictedSpeed, 3);
  });
});
