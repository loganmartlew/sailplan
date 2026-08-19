/** Speed the axis is scaled to at minimum, so a becalmed leg is not amplified. */
const MIN_CEILING_KN = 2;
/** Knots between gridlines. The ceiling is a gridline, so it is a multiple. */
export const SPEED_GRID_STEP_KN = 2;
/** Two points per pixel is already more than the screen can show. */
const POINTS_PER_PIXEL = 2;

export interface TraceSample {
  timestamp: number;
  stw: number | null;
}

/**
 * Where a time sits on the leg's axis, 0–1. The trace and the band are
 * contractually the same axis — a divider drawn anywhere but under the dip
 * that justifies it is most of the trace's value gone — so both project
 * through here.
 */
export function axisFraction(
  startTime: number,
  endTime: number,
  time: number,
): number {
  return (time - startTime) / Math.max(1, endTime - startTime);
}

/**
 * The axis ceiling: the next gridline above the speed actually sailed.
 *
 * It replaces `max(observed, 4) × 1.15`, which put a number on screen that
 * nobody sailed — "9 kn" over a leg whose real maximum was 7.8 — and labelled
 * it as though they had. A gridline multiple is the honest version: it is
 * visibly a scale mark, and the observed maximum gets a line of its own.
 */
export function traceCeiling(maxSpeed: number): number {
  return Math.max(
    MIN_CEILING_KN,
    Math.ceil(maxSpeed / SPEED_GRID_STEP_KN) * SPEED_GRID_STEP_KN,
  );
}

export interface TraceBox {
  /** The plot area only — the caller owns whatever padding surrounds it. */
  width: number;
  height: number;
  startTime: number;
  endTime: number;
}

export interface TraceGridline<T> {
  value: T;
  /** Pixels from the plot's left edge (time) or top edge (speed). */
  offset: number;
}

export interface TraceGeometry {
  /** The whole trace, pen lifted wherever speed is missing. */
  path: string;
  /**
   * Only the stretches the steadiness mask accepted, drawn over `path`. These
   * are the seconds that become polar points, so dragging a divider across one
   * visibly costs or buys the sailor a point.
   */
  steadyPath: string;
  /** The fastest speed actually sailed, or null when the leg recorded none. */
  maxSpeed: number | null;
  ceiling: number;
  speedGridlines: readonly TraceGridline<number>[];
  /** Elapsed minutes from the leg start, labelled where the sailor reads them. */
  timeGridlines: readonly TraceGridline<number>[];
  /** Where the observed maximum sits, in pixels from the plot's top edge. */
  maxSpeedOffset: number | null;
}

function timeGridStepMinutes(durationMs: number): number {
  if (durationMs > 20 * 60_000) return 5;
  if (durationMs > 8 * 60_000) return 2;
  return 1;
}

/**
 * Everything the speed chart draws, on the band's exact time axis.
 *
 * The trace's declared job is divider placement: nothing else on screen says
 * *when* in the leg the boat went slow, which is the only question a divider
 * can be an answer to. The axis, gridlines and mask are what let it also be
 * read — a dip is just as visible with a grid behind it, and the lit stretches
 * say which parts of the dip actually cost anything.
 */
export function buildTraceGeometry({
  samples,
  mask = [],
  box,
}: {
  samples: readonly TraceSample[];
  mask?: readonly { startTime: number; endTime: number }[];
  box: TraceBox;
}): TraceGeometry {
  const inRange = samples.filter(
    sample => sample.timestamp >= box.startTime && sample.timestamp <= box.endTime,
  );
  // Reduced rather than spread: a long leg's samples would be passed to
  // `Math.max` as arguments, and that has a limit.
  const maxSpeed = inRange.reduce<number | null>(
    (highest, sample) =>
      sample.stw === null ? highest : Math.max(highest ?? sample.stw, sample.stw),
    null,
  );
  const ceiling = traceCeiling(maxSpeed ?? 0);
  const y = (knots: number) => box.height - (knots / ceiling) * box.height;
  const stride = Math.max(
    1,
    Math.ceil(inRange.length / Math.max(1, box.width * POINTS_PER_PIXEL)),
  );
  const isSteady = (timestamp: number) =>
    mask.some(
      stretch => timestamp >= stretch.startTime && timestamp < stretch.endTime,
    );

  let path = '';
  let steadyPath = '';
  let pen = false;
  let steadyPen = false;
  for (let index = 0; index < inRange.length; index += stride) {
    const sample = inRange[index];
    if (sample.stw === null) {
      pen = false;
      steadyPen = false;
      continue;
    }
    const x = axisFraction(box.startTime, box.endTime, sample.timestamp) * box.width;
    const point = `${x.toFixed(1)} ${y(sample.stw).toFixed(1)}`;
    path += `${pen ? 'L' : 'M'}${point}`;
    pen = true;
    if (isSteady(sample.timestamp)) {
      steadyPath += `${steadyPen ? 'L' : 'M'}${point}`;
      steadyPen = true;
    } else {
      steadyPen = false;
    }
  }

  const durationMs = Math.max(1, box.endTime - box.startTime);
  const stepMs = timeGridStepMinutes(durationMs) * 60_000;
  const timeGridlines: TraceGridline<number>[] = [];
  for (let at = stepMs; at < durationMs; at += stepMs) {
    timeGridlines.push({ value: at / 60_000, offset: (at / durationMs) * box.width });
  }

  const speedGridlines: TraceGridline<number>[] = [];
  for (let knots = 0; knots <= ceiling; knots += SPEED_GRID_STEP_KN) {
    speedGridlines.push({ value: knots, offset: y(knots) });
  }

  return {
    path,
    steadyPath,
    maxSpeed,
    ceiling,
    speedGridlines,
    timeGridlines,
    maxSpeedOffset: maxSpeed === null ? null : y(maxSpeed),
  };
}
