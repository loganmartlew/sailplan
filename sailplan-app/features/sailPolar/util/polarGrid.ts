import type {
  PolarPoint,
  InterpolationConfig,
} from '../model/interpolation';

/**
 * One node of a {@link PolarGrid}: a polar point plus how many stored points
 * collapsed into it. `n` is the duplicate count on the exact grid and the bin
 * population on the clustered one — the same meaning ("rows behind this node")
 * from both builders, so confidence can never mean different things depending
 * on which builder served the query.
 *
 * `n` is deliberately **carried but not spent**: it must never lower confidence
 * (that was the bug), and it does not raise it either — see
 * `.tickets/nmea-ingestion/issues/16-blend-weight-and-coverage.md`.
 */
export interface PolarGridRow extends PolarPoint {
  /** Stored points behind this node (≥ 1). */
  n: number;
}

/**
 * A sail's polar points regrouped as a grid: TWS columns, each holding its
 * rows sorted by TWA. Grouping is by *exact* TWS value — floats are fine here
 * because rows come from user input / the CSV generator via SQLite and are
 * compared by identity within one dataset, never across arithmetic.
 *
 * **Invariant: a grid never holds two rows at the same (TWS, TWA) node.** Both
 * builders guarantee it. It sits upstream of every duplicate-row defect —
 * bracketing cannot pick a row by SQLite's ordering, the four bilinear corners
 * cannot come from different duplicate sets, and zero-width axis gaps are
 * structurally impossible, so {@link medianAxisGap} cannot be driven to 0 and
 * zero out confidence.
 *
 * The structure is cheap (O(n log n)) and built per `estimateSailSpeed` call,
 * matching the stateless design of the interpolation pipeline.
 */
export interface PolarGrid {
  /** Sorted unique TWS column values. */
  twsColumns: number[];
  /** Per column: rows sorted ascending by TWA, one per TWA value. */
  byTws: Map<number, PolarGridRow[]>;
}

/**
 * Groups points into exact-TWS columns, collapsing rows that share a
 * (TWS, TWA) node into one row carrying the **median** speed and its
 * contributing count.
 *
 * Collision is exact equality, never a tolerance: tolerance-based merging is
 * {@link buildClusteredPolarGrid}'s job (1 kn TWS, 4° TWA), and doing it in two
 * places at two widths produces results nobody can explain. This path exists to
 * reproduce hand-entered tables faithfully. Median matches the clustered path
 * and is deliberately neutral — a high statistic here would re-apply optimism
 * already applied when samples were promoted to points.
 */
export function buildPolarGrid(points: PolarPoint[]): PolarGrid {
  // Two-level grouping: TWS column → TWA node → the speeds stored there.
  const speedsByNode = new Map<number, Map<number, number[]>>();
  for (const point of points) {
    let column = speedsByNode.get(point.tws);
    if (!column) {
      column = new Map();
      speedsByNode.set(point.tws, column);
    }
    const speeds = column.get(point.twa);
    if (speeds) {
      speeds.push(point.speed);
    } else {
      column.set(point.twa, [point.speed]);
    }
  }

  const byTws = new Map<number, PolarGridRow[]>();
  for (const [tws, column] of speedsByNode) {
    const rows: PolarGridRow[] = [];
    for (const [twa, speeds] of column) {
      rows.push({ tws, twa, speed: median(speeds), n: speeds.length });
    }
    rows.sort((a, b) => a.twa - b.twa);
    byTws.set(tws, rows);
  }
  const twsColumns = [...byTws.keys()].sort((a, b) => a - b);
  return { twsColumns, byTws };
}

/** Median of a non-empty numeric list (sorts a copy). */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Builds a **noise-tolerant** grid for logged data (Package G). The exact-TWS
 * {@link buildPolarGrid} fails on logged imports: measurement noise gives nearly
 * every point a unique TWS, so every column holds one row and the bilinear path
 * can never bracket. This builder instead:
 *
 * 1. **Clusters TWS** — walks the sorted unique TWS values and starts a new
 *    column whenever the gap to the previous value exceeds
 *    `twsClusterTolerance`. Each cluster becomes one column whose TWS is the
 *    mean of its points (a real data centroid, not a lattice point).
 * 2. **Bins TWA per column** — groups each column's points into fixed-width
 *    `twaBinDeg` bins and collapses each bin to one synthetic row at the bin's
 *    mean TWA carrying the bin's **median** speed (robust to the 0.82–1.15×
 *    speed scatter of logged runs).
 *
 * On already-clean grids this reduces to the identity of {@link buildPolarGrid}
 * (each exact TWS is its own cluster; each single-point TWA bin keeps its
 * speed), so the caller can try it as a fallback without perturbing clean data.
 * Rows are returned sorted by TWA, columns by TWS — the shape the bilinear path
 * expects.
 */
export function buildClusteredPolarGrid(
  points: PolarPoint[],
  config: Pick<InterpolationConfig, 'twsClusterTolerance' | 'twaBinDeg'>,
): PolarGrid {
  if (points.length === 0) return { twsColumns: [], byTws: new Map() };

  // 1. Partition points into TWS clusters by gap threshold.
  const byTws = new Map<number, PolarGridRow[]>();
  const sorted = [...points].sort((a, b) => a.tws - b.tws);
  let cluster: PolarPoint[] = [sorted[0]];
  const flush = () => {
    const meanTws =
      cluster.reduce((sum, p) => sum + p.tws, 0) / cluster.length;
    byTws.set(meanTws, binColumnByTwa(cluster, meanTws, config.twaBinDeg));
  };
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].tws - sorted[i - 1].tws > config.twsClusterTolerance) {
      flush();
      cluster = [];
    }
    cluster.push(sorted[i]);
  }
  flush();

  const twsColumns = [...byTws.keys()].sort((a, b) => a - b);
  return { twsColumns, byTws };
}

/**
 * Collapses one TWS cluster's points into de-noised rows: fixed-width TWA bins
 * (`round(twa / binDeg)`), each emitting one row at the bin's mean TWA with the
 * bin's median speed and its population as `n`, all at the column's
 * `columnTws`. Rows sorted by TWA.
 */
function binColumnByTwa(
  points: PolarPoint[],
  columnTws: number,
  binDeg: number,
): PolarGridRow[] {
  const bins = new Map<number, PolarPoint[]>();
  for (const point of points) {
    const key = Math.round(point.twa / binDeg);
    const bin = bins.get(key);
    if (bin) bin.push(point);
    else bins.set(key, [point]);
  }
  const rows: PolarGridRow[] = [];
  for (const bin of bins.values()) {
    rows.push({
      tws: columnTws,
      twa: bin.reduce((sum, p) => sum + p.twa, 0) / bin.length,
      speed: median(bin.map(p => p.speed)),
      n: bin.length,
    });
  }
  rows.sort((a, b) => a.twa - b.twa);
  return rows;
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
