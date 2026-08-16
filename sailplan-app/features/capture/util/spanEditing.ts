export interface EditableSailSpan {
  startTime: number;
  endTime: number;
  sailId: number | null;
  /**
   * A stretch between two stored parts of one leg that no data covers. It is
   * shown so the leg reads as one row of blocks, and is fixed: never selected,
   * moved, split, assigned a sail, or merged through.
   */
  gap?: boolean;
}

export const MIN_SPAN_DURATION_MS = 15_000;

/** Every edit and every selection asks this: a no-data block answers no. */
export function isEditableSpan(
  span: EditableSailSpan | undefined,
): span is EditableSailSpan {
  return span !== undefined && span.gap !== true;
}

function isFixed(span: EditableSailSpan | undefined): boolean {
  return !isEditableSpan(span);
}

/**
 * A block carrying no sail is *expected* to be short — a trim is what the head
 * and tail guards are for, and a cut is meant to be small. Only a block the
 * sailor put a sail on can disappoint by contributing no polar point.
 */
export function spanFallsShortOfBin(span: EditableSailSpan): boolean {
  return (
    span.gap !== true &&
    span.sailId !== null &&
    span.endTime - span.startTime < MIN_SPAN_DURATION_MS
  );
}

export function findNearestDivider(
  spans: readonly EditableSailSpan[],
  targetTime: number,
): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < spans.length; index += 1) {
    if (isFixed(spans[index - 1]) || isFixed(spans[index])) continue;
    const distance = Math.abs(spans[index].startTime - targetTime);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  return nearestIndex;
}

export function assignSpanSail(
  spans: readonly EditableSailSpan[],
  spanIndex: number,
  sailId: number | null,
): readonly EditableSailSpan[] {
  if (isFixed(spans[spanIndex])) return spans;
  return spans.map((span, index) => index === spanIndex ? { ...span, sailId } : span);
}

export function moveDivider(
  spans: readonly EditableSailSpan[],
  dividerIndex: number,
  targetTime: number,
): readonly EditableSailSpan[] {
  const left = spans[dividerIndex - 1];
  const right = spans[dividerIndex];
  if (isFixed(left) || isFixed(right)) return spans;

  const currentTime = right.startTime;
  const earliestTime = Math.min(
    currentTime,
    left.startTime + MIN_SPAN_DURATION_MS,
  );
  const latestTime = Math.max(
    currentTime,
    right.endTime - MIN_SPAN_DURATION_MS,
  );
  const dividerTime = Math.min(
    latestTime,
    Math.max(earliestTime, Math.round(targetTime)),
  );
  return spans.map((span, index) => {
    if (index === dividerIndex - 1) return { ...span, endTime: dividerTime };
    if (index === dividerIndex) return { ...span, startTime: dividerTime };
    return span;
  });
}

export function nudgeSpanEdge(
  spans: readonly EditableSailSpan[],
  spanIndex: number,
  edge: 'start' | 'end',
  deltaMs: number,
): readonly EditableSailSpan[] {
  const span = spans[spanIndex];
  if (!span) return spans;
  const dividerIndex = edge === 'start' ? spanIndex : spanIndex + 1;
  const edgeTime = edge === 'start' ? span.startTime : span.endTime;
  return moveDivider(spans, dividerIndex, edgeTime + deltaMs);
}

export function deleteDivider(
  spans: readonly EditableSailSpan[],
  dividerIndex: number,
): readonly EditableSailSpan[] {
  const left = spans[dividerIndex - 1];
  const right = spans[dividerIndex];
  if (isFixed(left) || isFixed(right)) return spans;

  return [
    ...spans.slice(0, dividerIndex - 1),
    { ...left, endTime: right.endTime },
    ...spans.slice(dividerIndex + 1),
  ];
}

/**
 * Deleting the divider on one side of a block, named by the neighbour that
 * absorbs it. Every block is removable — including the first, which a single
 * "merge into previous" could never reach.
 */
export function mergeSpan(
  spans: readonly EditableSailSpan[],
  spanIndex: number,
  direction: 'left' | 'right',
): readonly EditableSailSpan[] {
  const span = spans[spanIndex];
  if (isFixed(span)) return spans;
  if (direction === 'left') return deleteDivider(spans, spanIndex);

  const right = spans[spanIndex + 1];
  if (isFixed(right)) return spans;
  return [
    ...spans.slice(0, spanIndex),
    { ...right, startTime: span.startTime },
    ...spans.slice(spanIndex + 2),
  ];
}

export function splitSpan(
  spans: readonly EditableSailSpan[],
  spanIndex: number,
): readonly EditableSailSpan[] {
  const span = spans[spanIndex];
  if (isFixed(span) || span.endTime - span.startTime < MIN_SPAN_DURATION_MS * 2) {
    return spans;
  }

  const dividerTime = splitTime(span);
  return [
    ...spans.slice(0, spanIndex),
    { ...span, endTime: dividerTime },
    { ...span, startTime: dividerTime },
    ...spans.slice(spanIndex + 1),
  ];
}

/** Where `splitSpan` would cut — the midpoint, so the editor can say so. */
export function splitTime(span: EditableSailSpan): number {
  return Math.round((span.startTime + span.endTime) / 2);
}
