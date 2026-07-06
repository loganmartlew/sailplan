import { SailPolar } from './sailPolar';

export type PolarPoint = Pick<SailPolar, 'tws' | 'twa' | 'speed'>;

export interface InterpolationResult {
  predictedSpeed: number;
  confidence: number;
  pointsUsed: PolarPoint[];
}

/**
 * Interpolation strategy.
 * - `'auto'` — bilinear when the data forms a usable grid around the target,
 *   else IDW. The grid attempt *is* the detection: no global heuristic.
 * - `'bilinear'` — grid only; returns a zero result when the grid attempt fails.
 * - `'idw'` — always the scattered-point IDW path (pre-upgrade behaviour).
 */
export type InterpolationStrategy = 'auto' | 'bilinear' | 'idw';

export interface InterpolationConfig {
  /** Strategy selection — see {@link InterpolationStrategy} */
  strategy: InterpolationStrategy;
  /** Max gap (knots) between bracketing TWS grid columns for bilinear to trust them */
  maxTwsGap: number;
  /** Max gap (degrees) between bracketing TWA grid rows for bilinear to trust them */
  maxTwaGap: number;
  /**
   * Noise-tolerant grid revival (Package G). When exact-TWS grouping yields no
   * usable columns — the signature of logged data, where measurement noise gives
   * nearly every point a unique TWS — a *clustered* grid is built instead.
   * `twsClusterTolerance` is the max TWS gap (knots) within one column cluster:
   * a wider gap starts a new column, so it must sit below the real column
   * spacing yet above the per-node TWS scatter.
   */
  twsClusterTolerance: number;
  /**
   * TWA bin width (degrees) used to de-noise rows within a clustered column:
   * points are grouped into fixed-width TWA bins, each collapsed to one
   * synthetic row at the bin's mean TWA carrying the bin's **median** speed.
   * Gap-based clustering can't be used on TWA — per-node angular scatter
   * overlaps the node spacing — so a fixed bin is used here instead.
   */
  twaBinDeg: number;
  /** Number of nearest polar points to use for interpolation (IDW path) */
  k: number;
  /** Exponent for inverse distance weighting (higher = closer points dominate more) */
  p: number;
  /** Scale factor applied to TWA differences to normalize against TWS (e.g. 0.25 means 4° TWA ≈ 1 kn TWS) */
  twaScale: number;
  /**
   * Maximum TWS difference (knots) for a polar point to be considered.
   * Also bounds how far outside the grid's TWS range bilinear may clamp.
   */
  maxTwsDelta: number;
  /**
   * Maximum TWA difference (degrees) for a polar point to be considered.
   * Also bounds how far outside a column's TWA range bilinear may clamp.
   */
  maxTwaDelta: number;
  /** Weights for each component of the IDW confidence score (should sum to 1) */
  confidenceWeights: {
    /** Weight for distance-based score — how close the nearest points are */
    distance: number;
    /** Weight for point count score — how many points exist in the search window */
    pointCount: number;
    /** Weight for coverage score — whether points bracket the target in TWS and TWA */
    coverage: number;
  };
}

export const DEFAULT_INTERPOLATION_CONFIG: InterpolationConfig = {
  strategy: 'auto',
  maxTwsGap: 8,
  maxTwaGap: 20,
  twsClusterTolerance: 1,
  twaBinDeg: 4,
  k: 6,
  p: 2,
  twaScale: 0.25,
  maxTwsDelta: 8,
  maxTwaDelta: 40,
  confidenceWeights: {
    distance: 0.5,
    pointCount: 0.3,
    coverage: 0.2,
  },
};
