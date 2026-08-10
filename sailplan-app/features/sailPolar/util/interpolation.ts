import {
  type PolarPoint,
  type InterpolationConfig,
  type InterpolationResult,
  DEFAULT_INTERPOLATION_CONFIG,
} from '../model/interpolation';
import {
  type PolarGrid,
  type PolarGridRow,
  buildPolarGrid,
  buildClusteredPolarGrid,
  bracketAxis,
  median,
  medianAxisGap,
} from './polarGrid';

const EPSILON = 1e-9;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ---------------------------------------------------------------------------
// Bilinear path — polar data as a grid (TWS columns × TWA rows)
// ---------------------------------------------------------------------------

/**
 * A 1-D TWA sample taken within a single TWS column, plus the confidence
 * factors that sampling earned:
 * - `twaFactor` — 1.0 when the target TWA is bracketed by (or on) grid rows;
 *   reduced in proportion to distance when clamped past the column's ends.
 * - `twaGapFactor` — penalises unusually wide brackets relative to the
 *   column's typical (median) row spacing.
 */
interface ColumnSample {
  speed: number;
  nodes: PolarGridRow[];
  twaFactor: number;
  twaGapFactor: number;
}

/**
 * Linear TWA interpolation within one TWS column. Returns `null` when the
 * column cannot bracket or clamp the target — fewer than 2 rows (a lone
 * measurement is not a grid column), a bracketing gap wider than `maxTwaGap`,
 * or a target further than `maxTwaDelta` past the column's ends.
 */
function sampleColumn(
  rows: PolarGridRow[],
  twa: number,
  config: InterpolationConfig,
): ColumnSample | null {
  if (rows.length < 2) return null;

  const twaValues = rows.map(r => r.twa);
  const bracket = bracketAxis(twaValues, twa);
  if (!bracket) return null;

  switch (bracket.kind) {
    case 'exact': {
      const row = rows[bracket.index];
      return { speed: row.speed, nodes: [row], twaFactor: 1, twaGapFactor: 1 };
    }
    case 'inside': {
      const lo = rows[bracket.loIndex];
      const hi = rows[bracket.hiIndex];
      const gap = hi.twa - lo.twa;
      if (gap > config.maxTwaGap) return null;
      const t = (twa - lo.twa) / gap;
      const typicalGap = medianAxisGap(twaValues)!;
      return {
        speed: lo.speed + (hi.speed - lo.speed) * t,
        nodes: [lo, hi],
        twaFactor: 1,
        twaGapFactor: Math.min(1, typicalGap / gap),
      };
    }
    case 'below':
    case 'above': {
      if (bracket.distance > config.maxTwaDelta) return null;
      const row = rows[bracket.index];
      return {
        speed: row.speed,
        nodes: [row],
        twaFactor: Math.max(0, 1 - bracket.distance / config.maxTwaDelta),
        twaGapFactor: 1,
      };
    }
  }
}

/**
 * Bilinear interpolation over the polar grid: bracket the target TWS between
 * two columns, linearly interpolate TWA within each, then blend the two
 * column speeds linearly in TWS. On a regular grid this recovers stored
 * speeds exactly at nodes and the bilinear blend of the 4 corners between
 * them — no IDW plateaus.
 *
 * Confidence is a bracketing statement: per-axis factors (1.0 when bracketed,
 * proportionally reduced when clamped past the grid's edge) multiplied by
 * gap factors that penalise unusually wide brackets.
 *
 * Returns `null` when the data doesn't form a usable grid around the target —
 * the caller falls back to IDW (strategy `'auto'`). The grid attempt is the
 * detection: ragged grids fail per-query, with no global heuristic.
 */
function interpolateBilinear(
  target: { tws: number; twa: number },
  grid: PolarGrid,
  config: InterpolationConfig,
): InterpolationResult | null {
  const bracket = bracketAxis(grid.twsColumns, target.tws);
  if (!bracket) return null;

  const columnAt = (index: number) =>
    sampleColumn(grid.byTws.get(grid.twsColumns[index])!, target.twa, config);

  switch (bracket.kind) {
    case 'exact': {
      const column = columnAt(bracket.index);
      if (!column) return null;
      return {
        predictedSpeed: column.speed,
        confidence: clamp01(column.twaFactor * column.twaGapFactor),
        pointsUsed: column.nodes,
      };
    }
    case 'below':
    case 'above': {
      // Clamp to the nearest column → 1-D TWA interpolation, TWS-penalised.
      if (bracket.distance > config.maxTwsDelta) return null;
      const column = columnAt(bracket.index);
      if (!column) return null;
      const twsFactor = Math.max(0, 1 - bracket.distance / config.maxTwsDelta);
      return {
        predictedSpeed: column.speed,
        confidence: clamp01(twsFactor * column.twaFactor * column.twaGapFactor),
        pointsUsed: column.nodes,
      };
    }
    case 'inside': {
      const tws0 = grid.twsColumns[bracket.loIndex];
      const tws1 = grid.twsColumns[bracket.hiIndex];
      const gap = tws1 - tws0;
      if (gap > config.maxTwsGap) return null;
      const lo = columnAt(bracket.loIndex);
      const hi = columnAt(bracket.hiIndex);
      // Either bracketing column failing to bracket/clamp the TWA fails the
      // whole attempt — blending a real sample with a missing one would skew.
      if (!lo || !hi) return null;
      const t = (target.tws - tws0) / gap;
      const twsGapFactor = Math.min(1, medianAxisGap(grid.twsColumns)! / gap);
      const twaFactor = Math.min(lo.twaFactor, hi.twaFactor);
      const twaGapFactor = Math.min(lo.twaGapFactor, hi.twaGapFactor);
      return {
        predictedSpeed: lo.speed + (hi.speed - lo.speed) * t,
        confidence: clamp01(twsGapFactor * twaFactor * twaGapFactor),
        pointsUsed: [...lo.nodes, ...hi.nodes],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// IDW path — scattered / partially gridded data
// ---------------------------------------------------------------------------

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

/** A polar point paired with its weighted distance to the target. */
export interface ScoredPolarPoint {
  point: PolarPoint;
  distance: number;
}

/**
 * Selects the k nearest polar points to a target wind condition.
 *
 * First filters points to a rectangular search window defined by
 * `maxTwsDelta` and `maxTwaDelta`, then sorts the remaining points
 * by weighted distance and returns the closest k, each paired with its
 * distance so downstream steps don't recompute it.
 *
 * Returns an empty array if no points fall within the search window.
 */
export function selectNearestPoints(
  target: { tws: number; twa: number },
  points: PolarPoint[],
  config: InterpolationConfig,
): ScoredPolarPoint[] {
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

  return withDistance.slice(0, config.k);
}

/**
 * Estimates boat speed using Inverse Distance Weighting (IDW) over the
 * nearest points selected by {@link selectNearestPoints}.
 *
 * Each point's contribution is weighted by `1 / distance^p`, so closer points
 * have exponentially more influence. Points effectively at zero distance
 * (within EPSILON) short-circuit the blend to avoid division by zero, their
 * speeds collapsed by median so twins at the target resolve deterministically.
 *
 * Returns `predictedSpeed = Σ(speed_i × weight_i) / Σ(weight_i)`
 */
export function interpolateSpeed(
  nearestPoints: ScoredPolarPoint[],
  config: InterpolationConfig,
): { predictedSpeed: number; pointsUsed: PolarPoint[] } {
  if (nearestPoints.length === 0) {
    return { predictedSpeed: 0, pointsUsed: [] };
  }

  // Points effectively at the target: their weight is unbounded, so they win
  // outright — but taking the first would make the answer depend on the order
  // SQLite handed the rows back. Collapse them by median, matching the grid
  // builders' rule for a collided node.
  const coincident = nearestPoints.filter(n => n.distance < EPSILON);
  if (coincident.length > 0) {
    const { tws, twa } = coincident[0].point;
    const speed = median(coincident.map(c => c.point.speed));
    // One collapsed node, as the grid builders would report — not one entry per
    // stored row, which would inflate the "N polar points" display.
    return { predictedSpeed: speed, pointsUsed: [{ tws, twa, speed }] };
  }

  let weightSum = 0;
  let speedSum = 0;

  for (const { point, distance } of nearestPoints) {
    const weight = 1 / Math.pow(distance, config.p);
    weightSum += weight;
    speedSum += point.speed * weight;
  }

  return {
    predictedSpeed: speedSum / weightSum,
    pointsUsed: nearestPoints.map(n => n.point),
  };
}

/**
 * Computes a confidence score (0–1) indicating how reliable the IDW
 * interpolation is.
 *
 * Combines three factors:
 * - **Distance score** (default weight 0.5): How close the nearest points are relative
 *   to the maximum search radius. Closer points yield a higher score.
 * - **Point count score** (default weight 0.3): How many polar points exist in the
 *   search window, saturating at k points.
 * - **Coverage score** (default weight 0.2): Whether the nearest points bracket the
 *   target in both TWS and TWA dimensions. Full bracket = 1.0, single-axis bracket = 0.5,
 *   no bracket = 0.0.
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
  return clamp01(raw);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Main entry point: estimates expected boat speed for a sail at a given (TWS, TWA)
 * using its polar data points.
 *
 * With the default `strategy: 'auto'`, the data is first treated as a grid
 * (TWS columns × TWA rows — the shape polar tables naturally take) and
 * evaluated bilinearly. When the grid can't bracket or clamp the target —
 * scattered imports, ragged columns, over-wide gaps — the scattered-point IDW
 * pipeline takes over:
 * 1. Filters polar points to the search window
 * 2. Selects the k nearest points (with distances)
 * 3. Computes IDW-interpolated speed
 * 4. Computes a confidence score for the prediction
 *
 * `strategy: 'idw'` forces the IDW path (pre-grid behaviour); `'bilinear'`
 * forces the grid path and returns a zero result when it fails.
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

  if (cfg.strategy !== 'idw' && points.length > 0) {
    // Try the exact-TWS grid first: it recovers clean hand-entered tables
    // byte-for-byte. Only when that can't serve the target — the signature of
    // logged data, where TWS noise makes every column single-row — build a
    // noise-tolerant clustered grid and retry (Package G).
    const exact = interpolateBilinear(target, buildPolarGrid(points), cfg);
    if (exact) return exact;
    const clustered = interpolateBilinear(
      target,
      buildClusteredPolarGrid(points, cfg),
      cfg,
    );
    if (clustered) return clustered;
    if (cfg.strategy === 'bilinear') {
      return { predictedSpeed: 0, confidence: 0, pointsUsed: [] };
    }
  }

  const allInWindow = points.filter(
    p =>
      Math.abs(target.tws - p.tws) <= cfg.maxTwsDelta &&
      Math.abs(target.twa - p.twa) <= cfg.maxTwaDelta,
  );

  const nearest = selectNearestPoints(target, points, cfg);
  const { predictedSpeed, pointsUsed } = interpolateSpeed(nearest, cfg);
  const confidence = computeConfidence(
    target,
    nearest.map(n => n.point),
    allInWindow,
    cfg,
  );

  return { predictedSpeed, confidence, pointsUsed };
}
