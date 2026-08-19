import type { ReplayCaptureSample } from './replayCaptureSession';
import {
  getReviewBand,
  legInterior,
  type DetectedSailedLeg,
} from './sailedLegDetection';
import { findSteadyStretches, type SteadyStretch } from './steadyState';
import { medianOrNull } from './statistics';

export type SailStampEvidence = {
  timestamp: number;
  sailId: number;
};

function samplesInLeg(
  samples: readonly ReplayCaptureSample[],
  leg: DetectedSailedLeg,
) {
  return samples.filter(sample =>
    sample.timestamp >= leg.startTime && sample.timestamp < leg.endTime,
  );
}

function guardedSpans(
  leg: DetectedSailedLeg,
  sailId: number | null,
) {
  const { interiorStart, interiorEnd } = interiorBounds(leg);
  return withGuards(leg, [{ startTime: interiorStart, endTime: interiorEnd, sailId }]);
}

function interiorBounds(leg: DetectedSailedLeg) {
  return legInterior(leg.startTime, leg.endTime);
}

/**
 * Every span edge here is pinned between something and the end of the leg
 * interior — the lower bound varies (the interior start, the running cursor,
 * the span's own start), which is why this is a plain clamp and not an
 * interior-specific helper.
 */
const clamp = (value: number, lowest: number, highest: number) =>
  Math.min(Math.max(value, lowest), highest);

function withGuards(
  leg: DetectedSailedLeg,
  interiorSpans: DetectedSailedLeg['draftSpans'],
) {
  const { interiorStart, interiorEnd } = interiorBounds(leg);
  const normalized: DetectedSailedLeg['draftSpans'] = [];
  let cursor = interiorStart;
  for (const span of interiorSpans) {
    const startTime = clamp(Math.max(span.startTime, cursor), interiorStart, interiorEnd);
    const endTime = clamp(span.endTime, startTime, interiorEnd);
    if (startTime > cursor) {
      normalized.push({ startTime: cursor, endTime: startTime, sailId: null });
    }
    if (endTime > startTime) normalized.push({ startTime, endTime, sailId: span.sailId });
    cursor = endTime;
  }
  if (cursor < interiorEnd) {
    normalized.push({ startTime: cursor, endTime: interiorEnd, sailId: null });
  }
  return [
    { startTime: leg.startTime, endTime: interiorStart, sailId: null },
    ...normalized,
    { startTime: interiorEnd, endTime: leg.endTime, sailId: null },
  ];
}

const SPEED_REGIME_SHIFT = 0.05;

/**
 * How far boat speed moved between two steady stretches, as a fraction of the
 * reference speed — or `null` when that fraction is undefined.
 *
 * A stalled or fouled log reading exactly 0.00 for a whole stretch is the
 * steadiest signal there is (`isSteady` asks every sample to sit within 5 % of
 * the mean, and 5 % of zero is zero), so a zero reference speed is reachable.
 * Dividing by it yields `Infinity` or `NaN`, and letting those fall through to
 * a comparison decides a boundary or a carry by accident: `NaN > 0.05` and
 * `NaN <= 0.05` are *both* false, so the same non-answer silently means "no
 * boundary" in one place and "refuse to carry" in the other. Naming the
 * undefined case makes each caller state its own conservative choice.
 */
function speedChangeRatio(from: number, to: number): number | null {
  if (from > 0) return Math.abs(to - from) / from;
  return from === to ? 0 : null;
}

/**
 * Where boat speed changed regime, as the window between the last qualifying
 * steady stretch of the old regime and the first of the new. Nobody sails a
 * transition at a settled speed — it is a hoist, a drop or a manoeuvre — so it
 * is the interval that feeds neither sail.
 */
function regimeTransitions(steady: readonly SteadyStretch[]) {
  return steady.slice(0, -1).flatMap((stretch, index) => {
    const next = steady[index + 1];
    const speedShift = speedChangeRatio(stretch.medianBoatSpeed, next.medianBoatSpeed);
    const conditionsRemainSimilar =
      getReviewBand(stretch.medianAbsTwa) === getReviewBand(next.medianAbsTwa)
      && Math.abs(stretch.medianTws - next.medianTws) <= 2;
    // An immeasurable shift — the boat left a dead-stop stretch — is a regime
    // change, so it becomes a boundary. Failing closed here means proposing a
    // transition nobody sails through, never carrying a sail across one.
    const shifted = speedShift === null || speedShift > SPEED_REGIME_SHIFT;
    return shifted && conditionsRemainSimilar
      ? [{ transitionStart: stretch.endTime, transitionEnd: next.startTime }]
      : [];
  });
}

function stampsOutsideTransitions(
  stamps: readonly SailStampEvidence[],
  boundaries: ReturnType<typeof regimeTransitions>,
) {
  return stamps.filter(stamp =>
    !boundaries.some(boundary =>
      stamp.timestamp >= boundary.transitionStart
      && stamp.timestamp < boundary.transitionEnd,
    ),
  );
}

function spansForOneStampedSail(
  leg: DetectedSailedLeg,
  legStamps: readonly SailStampEvidence[],
  steady: readonly SteadyStretch[],
) {
  const boundaries = regimeTransitions(steady);
  if (boundaries.length === 0) return guardedSpans(leg, legStamps[0].sailId);

  const { interiorStart, interiorEnd } = interiorBounds(leg);
  const regions = boundaries.map((boundary, index) => ({
    startTime: Math.max(
      index === 0 ? interiorStart : boundaries[index - 1].transitionEnd,
      interiorStart,
    ),
    endTime: Math.min(boundary.transitionStart, interiorEnd),
  })).filter(region => region.endTime > region.startTime);
  const finalStart = Math.max(boundaries.at(-1)!.transitionEnd, interiorStart);
  if (finalStart < interiorEnd) {
    regions.push({ startTime: finalStart, endTime: interiorEnd });
  }
  const claimed = new Set<number>();
  // A stamp made inside a transition claims nothing. Mid-peel the sailor may be
  // recording the sail coming down or the one going up, so neither neighbouring
  // regime is safe to hand it to — and handing it to the *nearest* one by
  // distance can attribute time to a sail that was not yet up. Transients feed
  // neither sail; the other two attribution paths already filter the same way.
  for (const stamp of stampsOutsideTransitions(legStamps, boundaries)) {
    const containing = regions.findIndex(region =>
      stamp.timestamp >= region.startTime && stamp.timestamp < region.endTime,
    );
    if (containing >= 0) {
      claimed.add(containing);
      continue;
    }
    // Still reachable for a stamp sitting in the head or tail guard, which is
    // outside every region but inside no transition.
    const nearest = regions
      .map((region, index) => ({
        index,
        distance: Math.min(
          Math.abs(stamp.timestamp - region.startTime),
          Math.abs(stamp.timestamp - region.endTime),
        ),
      }))
      .sort((first, second) => first.distance - second.distance)[0];
    if (nearest) claimed.add(nearest.index);
  }

  const spans: DetectedSailedLeg['draftSpans'] = [];
  let cursor = interiorStart;
  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    if (region.startTime > cursor) {
      spans.push({ startTime: cursor, endTime: region.startTime, sailId: null });
    }
    spans.push({
      ...region,
      sailId: claimed.has(index) ? legStamps[0].sailId : null,
    });
    cursor = region.endTime;
  }
  return withGuards(leg, spans);
}

/**
 * Spans for stamps that survive their transitions, each reaching as far as the
 * regime it sits in allows. With no transitions passed, a stamp's regime is the
 * whole leg interior.
 */
function stampSupportedSpans(
  leg: DetectedSailedLeg,
  sailChanges: readonly SailStampEvidence[],
  boundaries: ReturnType<typeof regimeTransitions> = [],
) {
  const { interiorStart, interiorEnd } = interiorBounds(leg);
  const supportedStamps = stampsOutsideTransitions(sailChanges, boundaries);
  if (supportedStamps.length === 0) return guardedSpans(leg, null);
  const spans: DetectedSailedLeg['draftSpans'] = [];
  let cursor = interiorStart;
  for (let index = 0; index < supportedStamps.length; index += 1) {
    const stamp = supportedStamps[index];
    const regimeStart = boundaries
      .filter(boundary => boundary.transitionEnd <= stamp.timestamp)
      .at(-1)?.transitionEnd ?? interiorStart;
    const regimeEnd = boundaries
      .find(boundary => boundary.transitionStart > stamp.timestamp)?.transitionStart ?? interiorEnd;
    const startTime = index === 0
      ? clamp(regimeStart, interiorStart, interiorEnd)
      : clamp(stamp.timestamp, cursor, interiorEnd);
    const endTime = index === supportedStamps.length - 1
      ? clamp(regimeEnd, startTime, interiorEnd)
      : Math.min(
          stamp.timestamp + 1_000,
          supportedStamps[index + 1].timestamp,
          regimeEnd,
          interiorEnd,
        );
    if (startTime > cursor) spans.push({ startTime: cursor, endTime: startTime, sailId: null });
    if (endTime > startTime) spans.push({ startTime, endTime, sailId: stamp.sailId });
    cursor = Math.max(cursor, endTime);
  }
  if (interiorEnd > cursor) spans.push({ startTime: cursor, endTime: interiorEnd, sailId: null });
  return withGuards(leg, spans);
}

function spansBetweenStampedSails(
  leg: DetectedSailedLeg,
  legStamps: readonly SailStampEvidence[],
  steady: readonly SteadyStretch[],
) {
  const orderedStamps = [...legStamps].sort((first, second) => first.timestamp - second.timestamp);
  const sailChanges = orderedStamps.filter((stamp, index) =>
    index === 0 || stamp.sailId !== orderedStamps[index - 1].sailId,
  );
  const candidates = regimeTransitions(steady);
  const supportedSailChanges = stampsOutsideTransitions(sailChanges, candidates);
  if (supportedSailChanges.length < 2) {
    return stampSupportedSpans(leg, supportedSailChanges, candidates);
  }
  if (candidates.length < supportedSailChanges.length - 1) {
    return stampSupportedSpans(leg, supportedSailChanges, candidates);
  }

  const selected: typeof candidates = [];
  for (let index = 1; index < supportedSailChanges.length; index += 1) {
    const previousEnd = selected.at(-1)?.transitionEnd ?? -Infinity;
    const earlierStampTime = supportedSailChanges[index - 1].timestamp;
    const boundary = candidates
      .filter(candidate =>
        candidate.transitionStart >= previousEnd
        && candidate.transitionStart >= earlierStampTime,
      )
      .sort((first, second) =>
        Math.abs(first.transitionEnd - supportedSailChanges[index].timestamp)
          - Math.abs(second.transitionEnd - supportedSailChanges[index].timestamp),
      )[0];
    if (!boundary) {
      return stampSupportedSpans(leg, supportedSailChanges, candidates);
    }
    selected.push(boundary);
  }

  const { interiorStart, interiorEnd } = interiorBounds(leg);
  const spans: DetectedSailedLeg['draftSpans'] = [];
  let cursor = interiorStart;
  for (let index = 0; index < selected.length; index += 1) {
    const laterStampTime = supportedSailChanges[index + 1].timestamp;
    const transitionStart = clamp(
      Math.min(selected[index].transitionStart, laterStampTime),
      cursor,
      interiorEnd,
    );
    const transitionEnd = clamp(
      Math.max(selected[index].transitionEnd, laterStampTime),
      transitionStart,
      interiorEnd,
    );
    if (transitionStart > cursor) {
      spans.push({
        startTime: cursor,
        endTime: transitionStart,
        sailId: supportedSailChanges[index].sailId,
      });
    }
    if (transitionEnd > transitionStart) spans.push({ startTime: transitionStart, endTime: transitionEnd, sailId: null });
    cursor = transitionEnd;
  }
  if (interiorEnd > cursor) {
    spans.push({
      startTime: cursor,
      endTime: interiorEnd,
      sailId: supportedSailChanges.at(-1)!.sailId,
    });
  }
  return withGuards(leg, spans);
}

/**
 * Draft spans for every leg, from the sail stamps and the steadiness mask.
 *
 * The mask is the session's, not this leg's: it runs **once**, over the whole
 * recording and sail-independently, and the three things that read it — regime
 * detection here, promotion, and manual selection — all read the same one.
 * Computing it per leg would let the same second of sailing be settled for one
 * consumer and not for another.
 */
export function proposeDraftAttribution(
  samples: readonly ReplayCaptureSample[],
  legs: readonly DetectedSailedLeg[],
  stamps: readonly SailStampEvidence[],
  mask: readonly SteadyStretch[] = findSteadyStretches(samples),
): DetectedSailedLeg[] {
  const evidence = legs.map(leg => {
    const legSamples = samplesInLeg(samples, leg);
    const legStamps = stamps.filter(stamp =>
      stamp.timestamp >= leg.startTime && stamp.timestamp < leg.endTime,
    );
    const sailIds = [...new Set(legStamps.map(stamp => stamp.sailId))];
    const steady = mask.filter(stretch =>
      stretch.endTime > leg.startTime && stretch.startTime < leg.endTime,
    );
    return {
      sailId: sailIds.length === 1 && steady.length > 0 ? sailIds[0] : null,
      hasStamp: legStamps.length > 0,
      legStamps,
      medianTws: medianOrNull(legSamples.flatMap(sample => sample.tws === null ? [] : [sample.tws])),
      steady,
    };
  });

  const canCarry = (sourceIndex: number, targetIndex: number) => {
    const source = evidence[sourceIndex];
    const target = evidence[targetIndex];
    if (
      source.sailId === null
      || target.hasStamp
      || source.medianTws === null
      || target.medianTws === null
      || source.steady.length === 0
      || target.steady.length === 0
      || regimeTransitions(source.steady).length > 0
      || regimeTransitions(target.steady).length > 0
      || getReviewBand(legs[sourceIndex].medianAbsTwa)
        !== getReviewBand(legs[targetIndex].medianAbsTwa)
      || Math.abs(source.medianTws - target.medianTws) > 2
    ) return false;
    const sourceStretch = sourceIndex < targetIndex
      ? source.steady.at(-1)!
      : source.steady[0];
    const targetStretch = sourceIndex < targetIndex
      ? target.steady[0]
      : target.steady.at(-1)!;
    // Carrying a sail one hop is an inference, so an immeasurable difference
    // is not licence to make it: no ratio, no carry.
    const speedShift = speedChangeRatio(
      sourceStretch.medianBoatSpeed,
      targetStretch.medianBoatSpeed,
    );
    return speedShift !== null && speedShift <= SPEED_REGIME_SHIFT;
  };

  const carryOffers = legs.map(() => [] as number[]);
  for (let sourceIndex = 0; sourceIndex < legs.length; sourceIndex += 1) {
    const targetIndex = [sourceIndex + 1, sourceIndex - 1]
      .find(candidate =>
        candidate >= 0
        && candidate < legs.length
        && canCarry(sourceIndex, candidate),
      );
    if (targetIndex !== undefined) {
      carryOffers[targetIndex].push(evidence[sourceIndex].sailId!);
    }
  }

  return legs.map((leg, index) => {
    if (new Set(evidence[index].legStamps.map(stamp => stamp.sailId)).size > 1) {
      return {
        ...leg,
        draftSpans: evidence[index].steady.length === 0
          ? guardedSpans(leg, null)
          : spansBetweenStampedSails(
              leg,
              evidence[index].legStamps,
              evidence[index].steady,
            ),
      };
    }
    const sailId = evidence[index].sailId;
    if (sailId !== null) {
      return {
        ...leg,
        draftSpans: spansForOneStampedSail(
          leg,
          evidence[index].legStamps,
          evidence[index].steady,
        ),
      };
    }
    const offeredSails = [...new Set(carryOffers[index])];
    const inferredSailId = !evidence[index].hasStamp && offeredSails.length === 1
      ? offeredSails[0]
      : null;
    return { ...leg, draftSpans: guardedSpans(leg, inferredSailId) };
  });
}
