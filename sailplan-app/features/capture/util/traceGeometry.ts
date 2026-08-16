/** Boat speed a trace is scaled to at minimum, so a slow leg is not amplified. */
const MIN_TOP_SPEED = 4;
const HEADROOM = 1.15;
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

export interface TraceBox {
  startTime: number;
  endTime: number;
  width: number;
  height: number;
}

/**
 * The speed-over-time line the band sits under. Without it the band is an
 * abstract bar: nothing on screen says *when* in the leg the boat went slow,
 * which is the only question a divider can be an answer to.
 *
 * `stw` is the polar's speed, so this is the same quantity promotion reads.
 * The pen lifts wherever speed is missing, so a dropout reads as a break
 * rather than a straight line across time that was never sailed.
 */
export function buildTracePath(
  samples: readonly TraceSample[],
  box: TraceBox,
): { d: string; topSpeed: number } {
  const inRange = samples.filter(
    sample => sample.timestamp >= box.startTime && sample.timestamp <= box.endTime,
  );
  const speeds = inRange
    .map(sample => sample.stw)
    .filter((stw): stw is number => stw !== null);
  const topSpeed = Math.max(MIN_TOP_SPEED, ...speeds) * HEADROOM;
  const stride = Math.max(
    1,
    Math.ceil(inRange.length / Math.max(1, box.width * POINTS_PER_PIXEL)),
  );

  let d = '';
  let pen = false;
  for (let index = 0; index < inRange.length; index += stride) {
    const sample = inRange[index];
    if (sample.stw === null) {
      pen = false;
      continue;
    }
    const x = axisFraction(box.startTime, box.endTime, sample.timestamp) * box.width;
    const y = box.height - (sample.stw / topSpeed) * box.height;
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  return { d, topSpeed };
}
