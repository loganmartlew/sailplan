import type { SailPolar } from '../model/sailPolar';
import type { PolarPoint } from '../model/interpolation';
import { estimateSailSpeed } from './interpolation';

export type PolarGroupPoint = Pick<PolarPoint, 'twa' | 'speed'>;

/**
 * Group polars by TWS value, sorted by TWA within each group.
 */
export function groupPolarsByTws(
  polars: SailPolar[],
): Map<number, PolarGroupPoint[]> {
  const groups = new Map<number, PolarGroupPoint[]>();

  for (const polar of polars) {
    const key = polar.tws;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({ twa: polar.twa, speed: polar.speed });
  }

  // Sort each group by TWA
  for (const points of groups.values()) {
    points.sort((a, b) => a.twa - b.twa);
  }

  return groups;
}

/**
 * Convert polar data (TWA angle, boat speed radial) to Cartesian coordinates.
 * For a half-polar chart (0–180°):
 *   x = speed × sin(TWA)
 *   y = speed × cos(TWA)
 * where TWA is in degrees. The 0° axis points upward (y+).
 */
export function toCartesian(
  twa: number,
  speed: number,
): { x: number; y: number } {
  const rad = (twa * Math.PI) / 180;
  return {
    x: speed * Math.sin(rad),
    y: speed * Math.cos(rad),
  };
}

/**
 * Get sorted unique TWS values from polars.
 */
export function getUniqueTwsValues(polars: SailPolar[]): number[] {
  return [...new Set(polars.map(p => p.tws))].sort((a, b) => a - b);
}

/**
 * Map a boat speed value to a color on a blue→red sequential scale.
 * Capped at 20 kn — speeds above this all map to red.
 */
export const MAX_SPEED_COLOR = 20;

export function getSpeedColor(speed: number): string {
  const t = Math.min(Math.max(speed / MAX_SPEED_COLOR, 0), 1);
  // Blue (220°) → Red (0°)
  const hue = Math.round(220 * (1 - t));
  return `hsl(${hue}, 80%, 50%)`;
}

/**
 * Generate a sequential color palette for TWS groups.
 * Goes from light blue to dark blue.
 */
export function getTwsColorScale(twsValues: number[]): Map<number, string> {
  const colors = new Map<number, string>();
  const n = twsValues.length;

  if (n === 0) return colors;
  if (n === 1) {
    colors.set(twsValues[0], 'hsl(210, 80%, 50%)');
    return colors;
  }

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Lightness goes from 70% (light) to 30% (dark)
    const lightness = Math.round(70 - 40 * t);
    colors.set(twsValues[i], `hsl(210, 80%, ${lightness}%)`);
  }

  return colors;
}

/** TWS values for interpolation curves (5–30 kn, 5 kn increments). */
export const INTERPOLATION_TWS_VALUES = [5, 10, 15, 20, 25, 30];

/** Minimum confidence to include a point in an interpolation curve. */
const CONFIDENCE_THRESHOLD = 0.5;

/** TWA sweep step in degrees. */
const TWA_STEP = 2;

/** Number of passes of moving-average smoothing applied to curve speeds. */
const SMOOTH_PASSES = 1;

/** Half-window size for moving-average smoothing (full window = 2*SMOOTH_RADIUS + 1). */
const SMOOTH_RADIUS = 1;

export interface InterpolationCurvePoint {
  twa: number;
  speed: number;
  confidence: number;
}

/**
 * Generate a multi-hue color palette for interpolation TWS curves.
 * Maps TWS from cool (blue) to warm (red) across the given values.
 */
export function getTwsInterpolationColorScale(
  twsValues: number[],
): Map<number, string> {
  const colors = new Map<number, string>();
  const n = twsValues.length;
  if (n === 0) return colors;
  if (n === 1) {
    colors.set(twsValues[0], 'hsl(210, 85%, 55%)');
    return colors;
  }
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Blue (220°) → Green (120°) → Yellow (50°) → Red (0°)
    const hue = Math.round(220 * (1 - t));
    colors.set(twsValues[i], `hsl(${hue}, 85%, 55%)`);
  }
  return colors;
}

/**
 * Smooth a segment's speed values using multiple passes of a moving average.
 * Preserves twa and confidence; only the speed is smoothed.
 */
function smoothSegment(
  segment: InterpolationCurvePoint[],
): InterpolationCurvePoint[] {
  if (segment.length < 3) return segment;

  let speeds = segment.map(p => p.speed);

  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const next = new Array<number>(speeds.length);
    for (let i = 0; i < speeds.length; i++) {
      const lo = Math.max(0, i - SMOOTH_RADIUS);
      const hi = Math.min(speeds.length - 1, i + SMOOTH_RADIUS);
      let sum = 0;
      for (let j = lo; j <= hi; j++) {
        sum += speeds[j];
      }
      next[i] = sum / (hi - lo + 1);
    }
    speeds = next;
  }

  return segment.map((p, i) => ({ ...p, speed: speeds[i] }));
}

/**
 * Generate an interpolation curve for a single TWS value.
 * Sweeps TWA only within the range covered by actual data points,
 * and returns contiguous segments where confidence >= threshold.
 */
export function generateTwsInterpolationCurve(
  tws: number,
  polars: PolarPoint[],
): InterpolationCurvePoint[][] {
  if (polars.length === 0) return [];

  // Limit sweep to the TWA range actually covered by data
  const twaValues = polars.map(p => p.twa);
  const minTwa = Math.min(...twaValues);
  const maxTwa = Math.max(...twaValues);

  const allPoints: (InterpolationCurvePoint | null)[] = [];

  for (let twa = minTwa; twa <= maxTwa; twa += TWA_STEP) {
    const result = estimateSailSpeed({ tws, twa }, polars);
    if (result.confidence >= CONFIDENCE_THRESHOLD) {
      allPoints.push({
        twa,
        speed: result.predictedSpeed,
        confidence: result.confidence,
      });
    } else {
      allPoints.push(null);
    }
  }

  // Split into contiguous segments
  const segments: InterpolationCurvePoint[][] = [];
  let current: InterpolationCurvePoint[] = [];

  for (const pt of allPoints) {
    if (pt !== null) {
      current.push(pt);
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }

  // Smooth each segment's speed values to remove interpolation jitter
  return segments.map(smoothSegment);
}

/**
 * Generate interpolation curves for all standard TWS values.
 * Returns a map of TWS → array of contiguous curve segments.
 */
export function generateAllTwsCurves(
  polars: PolarPoint[],
): Map<number, InterpolationCurvePoint[][]> {
  const result = new Map<number, InterpolationCurvePoint[][]>();
  for (const tws of INTERPOLATION_TWS_VALUES) {
    const segments = generateTwsInterpolationCurve(tws, polars);
    if (segments.length > 0) {
      result.set(tws, segments);
    }
  }
  return result;
}
