import type { SailPolar } from '../model/sailPolar';

export interface PolarGroupPoint {
  twa: number;
  speed: number;
}

export interface CartesianPolarPoint {
  x: number;
  y: number;
  twa: number;
  speed: number;
}

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
 * Get polar plot points converted to Cartesian coords, grouped by TWS.
 */
export function getPolarPlotPoints(
  polars: SailPolar[],
): Map<number, CartesianPolarPoint[]> {
  const groups = groupPolarsByTws(polars);
  const result = new Map<number, CartesianPolarPoint[]>();

  for (const [tws, points] of groups) {
    result.set(
      tws,
      points.map(p => ({
        ...toCartesian(p.twa, p.speed),
        twa: p.twa,
        speed: p.speed,
      })),
    );
  }

  return result;
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
const MAX_SPEED_COLOR = 20;

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
