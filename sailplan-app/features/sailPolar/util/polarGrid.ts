import type { PolarPoint } from '../model/interpolation';

/**
 * A sail's polar points regrouped as a grid: TWS columns, each holding its
 * rows sorted by TWA. Grouping is by *exact* TWS value — floats are fine here
 * because rows come from user input / the CSV generator via SQLite and are
 * compared by identity within one dataset, never across arithmetic.
 *
 * The structure is cheap (O(n log n)) and built per `estimateSailSpeed` call,
 * matching the stateless design of the interpolation pipeline.
 */
export interface PolarGrid {
  /** Sorted unique TWS column values. */
  twsColumns: number[];
  /** Per column: rows sorted ascending by TWA. */
  byTws: Map<number, PolarPoint[]>;
}

export function buildPolarGrid(points: PolarPoint[]): PolarGrid {
  const byTws = new Map<number, PolarPoint[]>();
  for (const point of points) {
    const column = byTws.get(point.tws);
    if (column) {
      column.push(point);
    } else {
      byTws.set(point.tws, [point]);
    }
  }
  for (const column of byTws.values()) {
    column.sort((a, b) => a.twa - b.twa);
  }
  const twsColumns = [...byTws.keys()].sort((a, b) => a - b);
  return { twsColumns, byTws };
}

/**
 * Where a target value sits relative to a sorted axis of grid lines.
 * - `exact` — on a grid line (within EPSILON)
 * - `inside` — strictly between two adjacent grid lines
 * - `below` / `above` — outside the axis range; `distance` is how far past
 *   the nearest end line the target sits
 */
export type AxisBracket =
  | { kind: 'exact'; index: number }
  | { kind: 'inside'; loIndex: number; hiIndex: number }
  | { kind: 'below'; index: number; distance: number }
  | { kind: 'above'; index: number; distance: number };

const EPSILON = 1e-9;

/**
 * Locates `target` on a sorted ascending array of grid-line values.
 * Returns `null` for an empty axis.
 */
export function bracketAxis(
  values: number[],
  target: number,
): AxisBracket | null {
  if (values.length === 0) return null;

  const first = values[0];
  const last = values[values.length - 1];
  if (target < first) {
    return { kind: 'below', index: 0, distance: first - target };
  }
  if (target > last) {
    return {
      kind: 'above',
      index: values.length - 1,
      distance: target - last,
    };
  }

  // Binary search for the first value >= target.
  let lo = 0;
  let hi = values.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  if (Math.abs(values[lo] - target) < EPSILON) {
    return { kind: 'exact', index: lo };
  }
  if (lo > 0 && Math.abs(values[lo - 1] - target) < EPSILON) {
    return { kind: 'exact', index: lo - 1 };
  }
  return { kind: 'inside', loIndex: lo - 1, hiIndex: lo };
}

/**
 * Median gap between adjacent grid lines on an axis — the "typical" spacing
 * used to penalise unusually wide brackets. Returns `null` when the axis has
 * fewer than two lines (no gaps to speak of).
 */
export function medianAxisGap(values: number[]): number | null {
  if (values.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < values.length; i++) {
    gaps.push(values[i] - values[i - 1]);
  }
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  return gaps.length % 2 === 1 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}
