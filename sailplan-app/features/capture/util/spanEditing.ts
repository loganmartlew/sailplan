export interface EditableSailSpan {
  startTime: number;
  endTime: number;
  sailId: number | null;
}

export const MIN_SPAN_DURATION_MS = 15_000;

export function canSpanHoldBin(span: EditableSailSpan): boolean {
  return span.endTime - span.startTime >= MIN_SPAN_DURATION_MS;
}

export function findNearestDivider(
  spans: readonly EditableSailSpan[],
  targetTime: number,
): number | null {
  if (spans.length < 2) return null;
  let nearestIndex = 1;
  let nearestDistance = Math.abs(spans[1].startTime - targetTime);
  for (let index = 2; index < spans.length; index += 1) {
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
  if (!spans[spanIndex]) return spans;
  return spans.map((span, index) => index === spanIndex ? { ...span, sailId } : span);
}

export function moveDivider(
  spans: readonly EditableSailSpan[],
  dividerIndex: number,
  targetTime: number,
): readonly EditableSailSpan[] {
  const left = spans[dividerIndex - 1];
  const right = spans[dividerIndex];
  if (!left || !right) return spans;

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
  if (!left || !right) return spans;

  return [
    ...spans.slice(0, dividerIndex - 1),
    { ...left, endTime: right.endTime },
    ...spans.slice(dividerIndex + 1),
  ];
}

export function splitSpan(
  spans: readonly EditableSailSpan[],
  spanIndex: number,
): readonly EditableSailSpan[] {
  const span = spans[spanIndex];
  if (!span || span.endTime - span.startTime < MIN_SPAN_DURATION_MS * 2) {
    return spans;
  }

  const dividerTime = Math.round((span.startTime + span.endTime) / 2);
  return [
    ...spans.slice(0, spanIndex),
    { ...span, endTime: dividerTime },
    { ...span, startTime: dividerTime },
    ...spans.slice(spanIndex + 1),
  ];
}
