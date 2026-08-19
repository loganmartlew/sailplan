import {
  detectCourseRoundings,
  type CourseRoundingMark,
} from './courseRoundingDetection';
import type { ReplayCaptureSample } from './replayCaptureSession';
import { median, medianOrNull } from './statistics';

export const LEG_WINDOW_MS = 90_000;
export const LEG_CHANGE_DEGREES = 25;
export const MIN_LEG_MS = 180_000;
export const DATA_GAP_MS = 5_000;
export const LEG_HEAD_GUARD_MS = 25_000;
export const LEG_TAIL_GUARD_MS = 10_000;

/**
 * A linked course's mark, as leg detection needs it. Position is not optional:
 * with a course linked, where the boat was against these marks is what the
 * boundaries are measured from, and the review path carrying only `id` and
 * `name` is precisely what made a rounding unmeasurable (ticket 22).
 */
export type SailedLegCourseMark = CourseRoundingMark;

export type DetectedSailSpan = {
  startTime: number;
  endTime: number;
  sailId: number | null;
};

export type DetectedSailedLeg = {
  ordinal: number;
  startTime: number;
  endTime: number;
  name: string;
  courseMarkId: number | null;
  medianAbsTwa: number;
  continuation: boolean;
  draftSpans: DetectedSailSpan[];
};

type ValidSample = ReplayCaptureSample & { twa: number };
type Segment = { startTime: number; endTime: number; values: ValidSample[] };

const medianTwa = (values: readonly ValidSample[]) =>
  median(values.map(sample => Math.abs(sample.twa)));

/** Width of a review band, in degrees of TWA. */
export const REVIEW_BAND_DEG = 10;

export const getReviewBand = (twa: number) => Math.floor(twa / REVIEW_BAND_DEG);

type TwaBoundary = { at: number; change: number };

function candidateBoundaries(values: readonly ValidSample[]): TwaBoundary[] {
  const candidates: { at: number; change: number }[] = [];
  let beforeStart = 0;
  let afterEnd = 0;
  for (let index = 0; index < values.length; index += 1) {
    const sample = values[index];
    while (values[beforeStart]?.timestamp < sample.timestamp - LEG_WINDOW_MS) beforeStart += 1;
    afterEnd = Math.max(afterEnd, index);
    while (values[afterEnd]?.timestamp <= sample.timestamp + LEG_WINDOW_MS) afterEnd += 1;
    const before = values.slice(beforeStart, index);
    const after = values.slice(index, afterEnd);
    // A full window on each side prevents the beginning/end of a recording
    // looking like a point-of-sail change merely because data runs out.
    if (
      before.length < LEG_WINDOW_MS / 1_000 ||
      after.length < LEG_WINDOW_MS / 1_000
    ) continue;
    const change = Math.abs(medianTwa(before) - medianTwa(after));
    if (change >= LEG_CHANGE_DEGREES) candidates.push({ at: sample.timestamp, change });
  }

  const clusters: (typeof candidates)[] = [];
  for (const candidate of candidates) {
    const cluster = clusters.at(-1);
    if (!cluster || candidate.at - cluster.at(-1)!.at > DATA_GAP_MS) {
      clusters.push([candidate]);
    } else {
      cluster.push(candidate);
    }
  }
  return clusters.map(cluster => {
    const greatest = Math.max(...cluster.map(item => item.change));
    const best = cluster.filter(item => item.change === greatest);
    return { at: best[Math.floor(best.length / 2)].at, change: greatest };
  });
}

function makeSegments(values: readonly ValidSample[]): Segment[] {
  if (values.length === 0) return [];
  const endTime = values.at(-1)!.timestamp + 1_000;
  let boundaries = candidateBoundaries(values).map(boundary => boundary.at);

  const build = () => {
    const starts = [values[0].timestamp, ...boundaries];
    const ends = [...boundaries, endTime];
    return starts.map((startTime, index) => ({
      startTime,
      endTime: ends[index],
      values: values.filter(value => value.timestamp >= startTime && value.timestamp < ends[index]),
    }));
  };

  // A brief excursion is not a sailed leg. If it returns to the same review
  // band, remove both edges; otherwise absorb it into the more similar side.
  while (true) {
    const segments = build();
    const shortIndex = segments.findIndex(segment => segment.endTime - segment.startTime < MIN_LEG_MS);
    if (shortIndex < 0) return segments;
    if (segments.length === 1) return [];
    if (shortIndex > 0 && shortIndex < segments.length - 1) {
      const left = medianTwa(segments[shortIndex - 1].values);
      const right = medianTwa(segments[shortIndex + 1].values);
      if (getReviewBand(left) === getReviewBand(right)) {
        boundaries.splice(shortIndex - 1, 2);
        continue;
      }
      const current = medianTwa(segments[shortIndex].values);
      boundaries.splice(Math.abs(current - left) <= Math.abs(current - right) ? shortIndex - 1 : shortIndex, 1);
    } else {
      boundaries.splice(shortIndex === 0 ? 0 : boundaries.length - 1, 1);
    }
  }
}

/**
 * The part of a leg that may carry a sail: everything but the head and tail
 * guards. The only place the guard arithmetic is written — draft attribution
 * bounds its spans by the same edges, and two copies of `+ HEAD` / `- TAIL`
 * are two things to keep in step.
 */
export function legInterior(startTime: number, endTime: number) {
  // A course-anchored leg can be shorter than the two guards put together —
  // a 7-leg race has short legs, and `MIN_LEG_MS` no longer holds them apart.
  // Scale the guards down rather than letting the interior invert.
  const span = Math.max(0, endTime - startTime);
  const total = LEG_HEAD_GUARD_MS + LEG_TAIL_GUARD_MS;
  const scale = span < total ? span / total : 1;
  return {
    interiorStart: startTime + LEG_HEAD_GUARD_MS * scale,
    interiorEnd: endTime - LEG_TAIL_GUARD_MS * scale,
  };
}

export function createGuardedDraftSpans(startTime: number, endTime: number): DetectedSailSpan[] {
  const { interiorStart, interiorEnd } = legInterior(startTime, endTime);
  return [
    { startTime, endTime: interiorStart, sailId: null },
    { startTime: interiorStart, endTime: interiorEnd, sailId: null },
    { startTime: interiorEnd, endTime, sailId: null },
  ];
}

/**
 * Leg boundaries from where the boat actually was relative to the known marks.
 *
 * A course of N marks is a race of N-1 legs by construction, and leg *i* is
 * named for marks *i* → *i+1* because that is where the boat physically went —
 * so a rounding that does not change the point of sail can no longer merge two
 * legs into one and misname every leg after it. The recording either side of
 * the course is outside every leg: the first leg starts at the first rounding,
 * not at the first sample, so pre-start manoeuvring is not a leg, and there is
 * no wrap-around leg from the finish back to the start.
 *
 * Returns `[]` when the course cannot be anchored at all — no positions, or
 * fewer than two marks found — and detection then falls back to `|TWA|`
 * segmentation exactly as before.
 */
function courseAnchoredLegs(
  samples: readonly ReplayCaptureSample[],
  courseMarks: readonly SailedLegCourseMark[],
  valid: readonly ValidSample[],
): DetectedSailedLeg[] {
  if (courseMarks.length < 2) return [];
  const roundings = detectCourseRoundings(samples, courseMarks);
  const boundaries: (number | null)[] = roundings.map(rounding => rounding?.at ?? null);
  if (boundaries.filter(boundary => boundary !== null).length < 2) return [];

  fillMissedMarks(boundaries, valid);

  const anchored = boundaries.flatMap((at, index) => (at === null ? [] : [{ at, index }]));
  return anchored.slice(0, -1).map((from, position) => {
    const to = anchored[position + 1];
    const startTime = from.at;
    const endTime = to.at;
    const within = valid.filter(
      sample => sample.timestamp >= startTime && sample.timestamp < endTime,
    );
    return {
      ordinal: position + 1,
      startTime,
      endTime,
      name: `${courseMarks[from.index].name} → ${courseMarks[to.index].name}`,
      courseMarkId: courseMarks[to.index].id,
      // A leg whose every sample lost TWA still has a start, an end and the
      // pair of marks it was sailed between, which is what the review files
      // data under; the median is the part that is missing, not the leg.
      medianAbsTwa: medianOrNull(within.map(sample => Math.abs(sample.twa))) ?? 0,
      // A dropout inside a course-anchored leg is a gap in one leg, not two
      // legs to present as one: the marks either side say it is a single leg.
      continuation: false,
      draftSpans: createGuardedDraftSpans(startTime, endTime),
    };
  });
}

/**
 * A mark the boat never came near claims no boundary of its own, so the leg it
 * ends falls back to the `|TWA|` segmenter within the window its neighbours
 * leave — which is the one thing that path is good at, a point-of-sail change
 * with no mark to measure against. When the window offers fewer changes than
 * there are marks missing from it, nothing is guessed: those marks stay
 * unassigned and their legs merge, which reports one long leg between the marks
 * that *were* seen rather than inventing boundaries between marks that were not.
 */
function fillMissedMarks(boundaries: (number | null)[], valid: readonly ValidSample[]): void {
  if (valid.length === 0) return;
  const changes = candidateBoundaries(valid);
  const taken = new Set<number>();
  for (let index = 0; index < boundaries.length; index += 1) {
    if (boundaries[index] !== null) continue;
    let end = index;
    while (end < boundaries.length && boundaries[end] === null) end += 1;
    const from = index === 0 ? valid[0].timestamp : boundaries[index - 1]!;
    const to = end === boundaries.length ? valid.at(-1)!.timestamp : boundaries[end]!;
    const missing = end - index;
    const available = changes
      .filter(change => change.at > from && change.at < to && !taken.has(change.at))
      .sort((first, second) => second.change - first.change)
      .slice(0, missing)
      .sort((first, second) => first.at - second.at);
    if (available.length === missing) {
      for (let offset = 0; offset < missing; offset += 1) {
        boundaries[index + offset] = available[offset].at;
        taken.add(available[offset].at);
      }
    }
    index = end - 1;
  }
}

export function detectSailedLegs(
  samples: readonly ReplayCaptureSample[],
  courseMarks: readonly SailedLegCourseMark[] = [],
): DetectedSailedLeg[] {
  const valid = samples
    .filter((sample): sample is ValidSample => sample.twa !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  // With a course linked, the marks say where the legs are. Without one — or
  // without the positions to anchor to — this falls through to the `|TWA|`
  // segmentation below, unchanged.
  const anchored = courseAnchoredLegs(samples, courseMarks, valid);
  if (anchored.length > 0) return anchored;

  const groups: ValidSample[][] = [];
  for (const sample of valid) {
    const group = groups.at(-1);
    if (!group || sample.timestamp - group.at(-1)!.timestamp > DATA_GAP_MS) groups.push([sample]);
    else group.push(sample);
  }

  const raw = groups.flatMap(makeSegments);
  let ordinal = 0;
  // Fallback names count each point of sail separately, so the third beat and
  // the third run are both "3" (spec §6, story 48). The leg ordinal is a
  // different number and naming from it makes the first run read "Run 2".
  const sailed = { Beat: 0, Run: 0 };
  let previousBand: number | null = null;
  let previousGroupEnd: number | null = null;
  let previousName = '';
  let previousCourseMarkId: number | null = null;
  return raw.map(segment => {
    const absTwa = medianTwa(segment.values);
    const band = getReviewBand(absTwa);
    const followsGap = previousGroupEnd !== null && segment.startTime - previousGroupEnd > DATA_GAP_MS;
    const continuation = followsGap && band === previousBand;
    if (!continuation) ordinal += 1;

    let name: string;
    let courseMarkId: number | null = null;
    if (continuation) {
      name = previousName;
      courseMarkId = previousCourseMarkId;
    } else if (courseMarks.length >= 2) {
      const from = courseMarks[(ordinal - 1) % courseMarks.length];
      const to = courseMarks[ordinal % courseMarks.length];
      name = `${from.name} → ${to.name}`;
      courseMarkId = to.id;
    } else {
      const pointOfSail = absTwa < 90 ? 'Beat' : 'Run';
      sailed[pointOfSail] += 1;
      name = `${pointOfSail} ${sailed[pointOfSail]}`;
    }

    previousBand = band;
    previousGroupEnd = segment.endTime;
    previousName = name;
    previousCourseMarkId = courseMarkId;
    return {
      ordinal,
      startTime: segment.startTime,
      endTime: segment.endTime,
      name,
      courseMarkId,
      medianAbsTwa: absTwa,
      continuation,
      draftSpans: createGuardedDraftSpans(segment.startTime, segment.endTime),
    };
  });
}
