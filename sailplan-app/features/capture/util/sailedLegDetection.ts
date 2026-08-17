import type { ReplayCaptureSample } from './replayCaptureSession';
import { median } from './statistics';

export const LEG_WINDOW_MS = 90_000;
export const LEG_CHANGE_DEGREES = 25;
export const MIN_LEG_MS = 180_000;
export const DATA_GAP_MS = 5_000;
export const LEG_HEAD_GUARD_MS = 25_000;
export const LEG_TAIL_GUARD_MS = 10_000;

export type SailedLegCourseMark = {
  id: number;
  name: string;
};

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

export const getReviewBand = (twa: number) => Math.floor(twa / 10);

function candidateBoundaries(values: readonly ValidSample[]): number[] {
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
    return best[Math.floor(best.length / 2)].at;
  });
}

function makeSegments(values: readonly ValidSample[]): Segment[] {
  if (values.length === 0) return [];
  const endTime = values.at(-1)!.timestamp + 1_000;
  let boundaries = candidateBoundaries(values);

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

export function createGuardedDraftSpans(startTime: number, endTime: number): DetectedSailSpan[] {
  return [
    { startTime, endTime: startTime + LEG_HEAD_GUARD_MS, sailId: null },
    { startTime: startTime + LEG_HEAD_GUARD_MS, endTime: endTime - LEG_TAIL_GUARD_MS, sailId: null },
    { startTime: endTime - LEG_TAIL_GUARD_MS, endTime, sailId: null },
  ];
}

export function detectSailedLegs(
  samples: readonly ReplayCaptureSample[],
  courseMarks: readonly SailedLegCourseMark[] = [],
): DetectedSailedLeg[] {
  const valid = samples
    .filter((sample): sample is ValidSample => sample.twa !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
  const groups: ValidSample[][] = [];
  for (const sample of valid) {
    const group = groups.at(-1);
    if (!group || sample.timestamp - group.at(-1)!.timestamp > DATA_GAP_MS) groups.push([sample]);
    else group.push(sample);
  }

  const raw = groups.flatMap(makeSegments);
  let ordinal = 0;
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
      name = `${absTwa < 90 ? 'Beat' : 'Run'} ${ordinal}`;
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
