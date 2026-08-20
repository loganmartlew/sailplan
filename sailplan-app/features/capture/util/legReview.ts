import { STEADY_MIN_MS } from './steadyState';

/** A stored `sailedLeg` row, as review needs to read it. */
export interface SailedLegPart {
  id: number;
  ordinal: number;
  name: string | null;
  startTime: number;
  endTime: number;
  reviewedAt: number | null;
  used: boolean;
  courseMarkId: number | null;
  sailSpans: readonly SpanShape[];
}

export interface SpanShape {
  startTime: number;
  endTime: number;
  sailId: number | null;
}

/** A window the steadiness mask accepted. Only its bounds matter here. */
export interface SteadyWindow {
  startTime: number;
  endTime: number;
}

/**
 * The name a leg is shown under. Detection always writes one, but the column is
 * nullable and a leg predating a naming fix can arrive without.
 */
export function sailedLegName(leg: {
  ordinal: number;
  name: string | null;
}): string {
  return leg.name ?? `Leg ${leg.ordinal}`;
}

/**
 * The stored rows of one leg, grouped into the legs a sailor sees.
 *
 * A leg interrupted by a data gap is stored as several rows sharing an ordinal
 * but reviewed — and listed, and counted — as one. Only *adjacent* rows join:
 * two separate runs of the same ordinal are two legs, not one leg with a
 * two-hour hole in it.
 */
export function groupSailedLegParts<T extends { ordinal: number }>(
  legs: readonly T[],
): T[][] {
  return legs.reduce<T[][]>((groups, leg) => {
    const current = groups.at(-1);
    if (current?.[0]?.ordinal === leg.ordinal) current.push(leg);
    else groups.push([leg]);
    return groups;
  }, []);
}

/**
 * Whole 15-second **steady bins** a window of time contains, given the mask.
 *
 * Whole, because a part-bin buys nothing: a stretch overlapping a block by 10 s
 * contributes no settled sailing at all, and reporting it as "a bit" would tell
 * the sailor a divider bought something it did not.
 *
 * **A steady bin is not a polar point.** It is 15 s of sailing the mask
 * accepted — an *upper bound* on what promotion could take from this window,
 * never a promise. `promotion.ts` then bins by TWS and TWA and needs
 * `MIN_BIN_SAMPLES` before any bin proposes a point, so the real race that
 * yields 88 steady bins yields 10 points. Anything reporting this number to the
 * sailor has to say *steady bins*, not points.
 */
export function steadyBinsWithin(
  mask: readonly SteadyWindow[],
  startTime: number,
  endTime: number,
): number {
  return mask.reduce((bins, stretch) => {
    const overlap =
      Math.min(endTime, stretch.endTime) - Math.max(startTime, stretch.startTime);
    return overlap > 0 ? bins + Math.floor(overlap / STEADY_MIN_MS) : bins;
  }, 0);
}

/** One leg as the session's list reports it: what it holds and what it yields. */
export interface SailedLegSummary {
  ordinal: number;
  name: string;
  startTime: number;
  endTime: number;
  /** Time the leg's stored parts actually cover, so a data gap is not counted. */
  durationMs: number;
  reviewed: boolean;
  used: boolean;
  /** Sails attributed anywhere in the leg, in the order the blocks run. */
  sailIds: readonly number[];
  steadyBins: number;
  attributedBins: number;
  sampleCount: number;
}

/**
 * What each leg of a session holds, for the list that is now review's home.
 *
 * The rows report **what a leg holds** — sails, steady bins, whether it was
 * edited — rather than whether it was ticked: there is no per-leg act to tick.
 * The bins come from the session's own mask, the same one promotion reads, so
 * they are the right scale to compare legs by; see {@link steadyBinsWithin} for
 * why they are an upper bound on points rather than a count of them.
 */
export function summarizeSailedLegs({
  legs,
  mask,
  samples,
}: {
  legs: readonly SailedLegPart[];
  mask: readonly SteadyWindow[];
  samples: readonly { timestamp: number }[];
}): SailedLegSummary[] {
  return groupSailedLegParts(legs).map(parts => {
    const startTime = parts[0].startTime;
    const endTime = parts.at(-1)!.endTime;
    const covers = (timestamp: number) =>
      parts.some(part => timestamp >= part.startTime && timestamp < part.endTime);
    const spans = parts.flatMap(part => part.sailSpans);
    return {
      ordinal: parts[0].ordinal,
      name: sailedLegName(parts[0]),
      startTime,
      endTime,
      durationMs: parts.reduce(
        (total, part) => total + (part.endTime - part.startTime),
        0,
      ),
      reviewed: parts.some(part => part.reviewedAt !== null),
      used: parts.every(part => part.used),
      sailIds: [
        ...new Set(
          spans.flatMap(span => (span.sailId === null ? [] : [span.sailId])),
        ),
      ],
      steadyBins: parts.reduce(
        (bins, part) => bins + steadyBinsWithin(mask, part.startTime, part.endTime),
        0,
      ),
      attributedBins: spans.reduce(
        (bins, span) =>
          span.sailId === null
            ? bins
            : bins + steadyBinsWithin(mask, span.startTime, span.endTime),
        0,
      ),
      sampleCount: samples.filter(sample => covers(sample.timestamp)).length,
    };
  });
}

/**
 * Whether a draft save actually changes the leg, which is what makes it
 * **reviewed**.
 *
 * `reviewedAt` has to mean *there is hand work here to lose* — it gates
 * promotion, positions the re-detect warning, and blocks resuming an auto-ended
 * recording whose spans a re-detect would delete. Setting it on a mere visit
 * marks legs with nothing to lose, which is the wrong answer for all three.
 */
export function sailedLegDraftChanged(
  stored: {
    ordinal: number;
    name: string | null;
    used: boolean;
    spans: readonly SpanShape[];
  },
  next: { name: string; used: boolean; spans: readonly SpanShape[] },
): boolean {
  if (next.used !== stored.used) return true;
  if (next.name.trim() !== sailedLegName(stored)) return true;
  if (next.spans.length !== stored.spans.length) return true;
  return next.spans.some((span, index) => {
    const before = stored.spans[index];
    return (
      span.startTime !== before.startTime
      || span.endTime !== before.endTime
      || span.sailId !== before.sailId
    );
  });
}
