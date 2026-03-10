export interface PolarPoint {
  tws: number;
  twa: number;
  speed: number;
}

export interface InterpolationResult {
  predictedSpeed: number;
  confidence: number;
  pointsUsed: PolarPoint[];
}

export interface InterpolationConfig {
  /** Number of nearest polar points to use for interpolation */
  k: number;
  /** Exponent for inverse distance weighting (higher = closer points dominate more) */
  p: number;
  /** Scale factor applied to TWA differences to normalize against TWS (e.g. 0.25 means 4° TWA ≈ 1 kn TWS) */
  twaScale: number;
  /** Maximum TWS difference (knots) for a polar point to be considered */
  maxTwsDelta: number;
  /** Maximum TWA difference (degrees) for a polar point to be considered */
  maxTwaDelta: number;
  /** Weights for each component of the confidence score (should sum to 1) */
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
