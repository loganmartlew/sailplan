import type {
  InterpolationConfig,
  InterpolationResult,
  PolarPoint,
} from '../model/interpolation';
import type { SailPolar } from '../model/sailPolar';
import { estimateSailSpeed } from './interpolation';

/**
 * A polar point with its provenance. An omitted kind is deliberately treated as
 * non-capture so existing callers retain their established behaviour.
 */
export type SourceAwarePolarPoint = PolarPoint & {
  sourceKind?: SailPolar['sourceKind'];
};

/**
 * Interim capture contribution, pending calibration against real race data in
 * ticket 16. Do not treat this as a validated trust setting.
 */
export const CAPTURE_BLEND_WEIGHT = 0.5;

/**
 * Interim capture coverage rectangle (kn × degrees), pending ticket 16
 * calibration. Do not treat this as a validated trust setting.
 *
 * Read on two paths, not one: the blend weight below, and `evaluateSail`'s
 * coverage envelope, which admits a captured point to TWA-limit scoring only
 * within this radius. Ticket 16 moves both.
 */
export const CAPTURE_COVERAGE_RADIUS = {
  tws: 1,
  twa: 10,
} as const;

type Target = Pick<PolarPoint, 'tws' | 'twa'>;

/** Whether one captured point is near enough to inform this wind condition. */
export function isCaptureWithinCoverage(
  target: Target,
  point: PolarPoint,
): boolean {
  return (
    Math.abs(target.tws - point.tws) <= CAPTURE_COVERAGE_RADIUS.tws &&
    Math.abs(target.twa - point.twa) <= CAPTURE_COVERAGE_RADIUS.twa
  );
}

function captureWeightAt(target: Target, capturedPoints: PolarPoint[]): number {
  const nearestRelativeDistance = capturedPoints.reduce(
    (nearest, point) =>
      Math.min(
        nearest,
        Math.max(
          Math.abs(target.tws - point.tws) / CAPTURE_COVERAGE_RADIUS.tws,
          Math.abs(target.twa - point.twa) / CAPTURE_COVERAGE_RADIUS.twa,
        ),
      ),
    Number.POSITIVE_INFINITY,
  );

  if (nearestRelativeDistance > 1) return 0;

  // The inner half of the coverage rectangle gets the named full weight; the
  // outer half is a linear fade to zero at its edge.
  const coverage =
    nearestRelativeDistance <= 0.5 ? 1 : 2 * (1 - nearestRelativeDistance);
  return CAPTURE_BLEND_WEIGHT * coverage;
}

/**
 * Estimates speed without pooling measured points into imported/manual grids.
 *
 * Capture is the only separated source. Every other source kind deliberately
 * remains on the established grid, so future non-capture provenance preserves
 * today's behaviour. Captured points from every session share one estimate.
 */
export function estimateSourceAwareSailSpeed(
  target: Target,
  points: SourceAwarePolarPoint[],
  config?: Partial<InterpolationConfig>,
): InterpolationResult {
  const nonCapturePoints = points.filter(point => point.sourceKind !== 'capture');
  const capturedPoints = points.filter(point => point.sourceKind === 'capture');

  const nonCaptureEstimate = estimateSailSpeed(
    target,
    nonCapturePoints,
    config,
  );
  const capturedEstimate = estimateSailSpeed(target, capturedPoints, config);
  const captureWeight = captureWeightAt(target, capturedPoints);

  if (nonCaptureEstimate.pointsUsed.length === 0) {
    return captureWeight === 0 ? nonCaptureEstimate : capturedEstimate;
  }

  if (capturedEstimate.pointsUsed.length === 0 || captureWeight === 0) {
    return nonCaptureEstimate;
  }

  return {
    predictedSpeed:
      nonCaptureEstimate.predictedSpeed * (1 - captureWeight) +
      capturedEstimate.predictedSpeed * captureWeight,
    confidence:
      nonCaptureEstimate.confidence * (1 - captureWeight) +
      capturedEstimate.confidence * captureWeight,
    pointsUsed: [...nonCaptureEstimate.pointsUsed, ...capturedEstimate.pointsUsed],
  };
}
