import type { EditableSailSpan } from './spanEditing';

/**
 * One sailed leg interrupted by a data gap is stored as several `sailedLeg`
 * rows, but a sailor seeing the same leg twice — each half asking to be
 * assigned separately — is the confusion review exists to remove. So the parts
 * are joined into one band, with the uncovered time standing as a fixed
 * "no data" block, and split apart again on confirm.
 */
export function unifyLegParts(
  parts: readonly (readonly EditableSailSpan[])[],
): readonly EditableSailSpan[] {
  return parts.flatMap((spans, index) => {
    const previousEnd = parts[index - 1]?.at(-1)?.endTime;
    const startTime = spans[0]?.startTime;
    if (previousEnd === undefined || startTime === undefined || startTime <= previousEnd) {
      return spans;
    }
    return [
      { startTime: previousEnd, endTime: startTime, sailId: null, gap: true },
      ...spans,
    ];
  });
}

/**
 * The inverse of {@link unifyLegParts}: the gap blocks are exactly the seams,
 * so serialising back to per-`sailedLeg` span lists is splitting at them. A
 * block's stated duration therefore never includes time no data covers.
 */
export function splitLegBand(
  band: readonly EditableSailSpan[],
  partCount: number,
): readonly EditableSailSpan[][] {
  const parts: EditableSailSpan[][] = [[]];
  for (const span of band) {
    if (span.gap === true) parts.push([]);
    else parts.at(-1)!.push(span);
  }
  while (parts.length < partCount) parts.push([]);
  return parts;
}
