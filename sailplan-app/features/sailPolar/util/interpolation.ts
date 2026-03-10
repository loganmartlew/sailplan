import {
  type PolarPoint,
  type InterpolationConfig,
  type InterpolationResult,
  DEFAULT_INTERPOLATION_CONFIG,
} from '../model/interpolation';

/**
 * Computes the distance between a target wind condition and a polar data point
 * using a weighted Euclidean metric. TWA differences are scaled down by `twaScale`
 * to normalize angular degrees against wind speed in knots.
 *
 * `distance = sqrt(ΔTWS² + (ΔTWA × twaScale)²)`
 */
export function computeDistance(
  target: { tws: number; twa: number },
  point: PolarPoint,
  twaScale: number,
): number {
  const dTws = target.tws - point.tws;
  const dTwa = (target.twa - point.twa) * twaScale;
  return Math.sqrt(dTws * dTws + dTwa * dTwa);
}

/**
 * Selects the k nearest polar points to a target wind condition.
 *
 * First filters points to a rectangular search window defined by
 * `maxTwsDelta` and `maxTwaDelta`, then sorts the remaining points
 * by weighted distance and returns the closest k.
 *
 * Returns an empty array if no points fall within the search window.
 */
export function selectNearestPoints(
  target: { tws: number; twa: number },
  points: PolarPoint[],
  config: InterpolationConfig,
): PolarPoint[] {
  const filtered = points.filter(
    p =>
      Math.abs(target.tws - p.tws) <= config.maxTwsDelta &&
      Math.abs(target.twa - p.twa) <= config.maxTwaDelta,
  );

  const withDistance = filtered.map(p => ({
    point: p,
    distance: computeDistance(target, p, config.twaScale),
  }));

  withDistance.sort((a, b) => a.distance - b.distance);

  return withDistance.slice(0, config.k).map(d => d.point);
}

const EPSILON = 1e-9;

/**
 * Estimates boat speed at a target (TWS, TWA) using Inverse Distance Weighting (IDW).
 *
 * Each point's contribution is weighted by `1 / distance^p`, so closer points
 * have exponentially more influence. If a point is effectively at zero distance
 * (within EPSILON), its speed is returned directly to avoid division by zero.
 *
 * Returns `predictedSpeed = Σ(speed_i × weight_i) / Σ(weight_i)`
 */
export function interpolateSpeed(
  target: { tws: number; twa: number },
  nearestPoints: PolarPoint[],
  config: InterpolationConfig,
): { predictedSpeed: number; pointsUsed: PolarPoint[] } {
  if (nearestPoints.length === 0) {
    return { predictedSpeed: 0, pointsUsed: [] };
  }

  let weightSum = 0;
  let speedSum = 0;

  for (const point of nearestPoints) {
    const dist = computeDistance(target, point, config.twaScale);
    if (dist < EPSILON) {
      return { predictedSpeed: point.speed, pointsUsed: [point] };
    }
    const weight = 1 / Math.pow(dist, config.p);
    weightSum += weight;
    speedSum += point.speed * weight;
  }

  return {
    predictedSpeed: speedSum / weightSum,
    pointsUsed: nearestPoints,
  };
}

/**
 * Computes a confidence score (0–1) indicating how reliable the interpolation is.
 *
 * Combines three factors:
 * - **Distance score** (default weight 0.5): How close the nearest points are relative
 *   to the maximum search radius. Closer points yield a higher score.
 * - **Point count score** (default weight 0.3): How many polar points exist in the
 *   search window, saturating at k points.
 * - **Coverage score** (default weight 0.2): Whether the nearest points bracket the
 *   target in both TWS and TWA dimensions. Full bracket = 1.0, single-axis bracket = 0.5,
 *   no bracket = 0.0.
 *
 * Thresholds (applied by caller): ≥0.6 reliable, 0.3–0.6 usable, <0.3 unreliable.
 */
export function computeConfidence(
  target: { tws: number; twa: number },
  nearestPoints: PolarPoint[],
  allPointsInWindow: PolarPoint[],
  config: InterpolationConfig,
): number {
  if (nearestPoints.length === 0) return 0;

  // Distance score: how close the nearest points are
  const maxSearchDist = computeDistance(
    target,
    {
      tws: target.tws + config.maxTwsDelta,
      twa: target.twa + config.maxTwaDelta,
      speed: 0,
    },
    config.twaScale,
  );
  let totalWeightedDist = 0;
  let totalWeight = 0;
  for (const point of nearestPoints) {
    const dist = computeDistance(target, point, config.twaScale);
    const w = 1 / Math.max(dist, EPSILON);
    totalWeightedDist += dist * w;
    totalWeight += w;
  }
  const avgWeightedDist = totalWeightedDist / totalWeight;
  const distanceScore = Math.max(
    0,
    Math.min(1, 1 - avgWeightedDist / maxSearchDist),
  );

  // Point count score: how many points are in the search window
  const pointCountScore = Math.min(allPointsInWindow.length / config.k, 1);

  // Coverage score: do points bracket the target in TWS and TWA?
  let hasTwsAbove = false;
  let hasTwsBelow = false;
  let hasTwaAbove = false;
  let hasTwaBelow = false;
  for (const point of nearestPoints) {
    if (point.tws >= target.tws) hasTwsAbove = true;
    if (point.tws <= target.tws) hasTwsBelow = true;
    if (point.twa >= target.twa) hasTwaAbove = true;
    if (point.twa <= target.twa) hasTwaBelow = true;
  }
  const twsBracketed = hasTwsAbove && hasTwsBelow;
  const twaBracketed = hasTwaAbove && hasTwaBelow;
  const coverageScore =
    twsBracketed && twaBracketed
      ? 1.0
      : twsBracketed || twaBracketed
        ? 0.5
        : 0.0;

  const { distance, pointCount, coverage } = config.confidenceWeights;
  const raw =
    distance * distanceScore +
    pointCount * pointCountScore +
    coverage * coverageScore;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Main entry point: estimates expected boat speed for a sail at a given (TWS, TWA)
 * using its polar data points.
 *
 * Orchestrates the full interpolation pipeline:
 * 1. Filters polar points to the search window
 * 2. Selects the k nearest points
 * 3. Computes IDW-interpolated speed
 * 4. Computes a confidence score for the prediction
 *
 * Accepts an optional partial config to override any default interpolation parameters.
 * Returns `{ predictedSpeed: 0, confidence: 0, pointsUsed: [] }` when no data is available.
 */
export function estimateSailSpeed(
  target: { tws: number; twa: number },
  points: PolarPoint[],
  config?: Partial<InterpolationConfig>,
): InterpolationResult {
  const cfg: InterpolationConfig = {
    ...DEFAULT_INTERPOLATION_CONFIG,
    ...config,
  };

  const allInWindow = points.filter(
    p =>
      Math.abs(target.tws - p.tws) <= cfg.maxTwsDelta &&
      Math.abs(target.twa - p.twa) <= cfg.maxTwaDelta,
  );

  const nearest = selectNearestPoints(target, points, cfg);
  const { predictedSpeed, pointsUsed } = interpolateSpeed(target, nearest, cfg);
  const confidence = computeConfidence(target, nearest, allInWindow, cfg);

  return { predictedSpeed, confidence, pointsUsed };
}
