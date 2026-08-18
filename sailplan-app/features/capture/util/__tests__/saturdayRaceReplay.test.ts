import fs from 'fs';
import path from 'path';
import { rawLogReplayInput } from '../rawLogReplay';
import { replayCaptureSession, type ReplayCaptureSample } from '../replayCaptureSession';
import { distanceMetres } from '../reviewMapMarks';
import { median } from '../statistics';
import type { DetectedSailedLeg, SailedLegCourseMark } from '../sailedLegDetection';

/**
 * The real-race replay harness (ticket 21). Off-device, this runs the actual
 * pipeline — `rawLogReplayInput` → `replayCaptureSession` → `detectSailedLegs` —
 * over Saturday 15 August 2026's log and reports what leg detection made of a
 * 7-leg course, so a defect is diagnosed in seconds on a laptop rather than by
 * rebuilding an APK and re-sailing.
 *
 * What the run shows is printed in full, because the per-leg picture is the
 * diagnostic: the manifest's sailed truth is the eight roundings the track
 * itself proves, and the report puts each of them next to the nearest boundary
 * median-`|TWA|` found, so a missed boundary is read off directly.
 *
 * The regression assertion is `detectsTheSailedLegs` below. It is written
 * against the truth and currently records the **defect** — ticket 22 replaces
 * the recorded numbers with the truth as course-anchored detection lands them.
 */

type ManifestMark = SailedLegCourseMark & {
  markId: number;
  latitude: number;
  longitude: number;
  direction: string | null;
};

type ManifestLeg = {
  ordinal: number;
  name: string;
  courseMarkId: number;
  startTime: string;
  endTime: string;
};

type Manifest = {
  courseName: string;
  legCount: number;
  marks: ManifestMark[];
  roundings: { courseMarkId: number; name: string; at: string; metres: number }[];
  sailedLegs: ManifestLeg[];
};

const fixtureDirectory = path.resolve(
  process.cwd(),
  'features/capture/util/__tests__/fixtures',
);

const manifest = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, 'saturday-race.manifest.json'), 'utf8'),
) as Manifest;

const log = fs.readFileSync(path.join(fixtureDirectory, 'saturday-race.log'), 'utf8');

const result = replayCaptureSession({
  ...rawLogReplayInput(log),
  courseMarks: manifest.marks,
});

/** Local race time, which is how the sailor remembers when a leg happened. */
const clock = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour12: false,
  });

const minutes = (ms: number) => `${(ms / 60_000).toFixed(1)}m`;

const fixes = result.samples.filter(
  (sample): sample is ReplayCaptureSample & { lat: number; lon: number } =>
    sample.lat !== null && sample.lon !== null,
);

/** Closest the boat ever came to a mark, and when. */
function closestApproach(
  mark: ManifestMark,
  within: readonly (ReplayCaptureSample & { lat: number; lon: number })[] = fixes,
) {
  let best = { metres: Infinity, timestamp: 0 };
  for (const fix of within) {
    const metres = distanceMetres(
      { latitude: fix.lat, longitude: fix.lon },
      { latitude: mark.latitude, longitude: mark.longitude },
    );
    if (metres < best.metres) best = { metres, timestamp: fix.timestamp };
  }
  return best;
}

/**
 * The roundings a course-anchored detector would find: each mark's closest
 * approach *after* the previous one, so the two North Head and two Salt Works
 * roundings of this course resolve in the order they were sailed rather than
 * both collapsing onto whichever pass came nearer.
 */
function sequentialRoundings() {
  let from = 0;
  return manifest.marks.map(mark => {
    const approach = closestApproach(mark, fixes.slice(from));
    const index = fixes.findIndex(fix => fix.timestamp === approach.timestamp);
    if (index >= 0) from = index + 1;
    return { mark, ...approach };
  });
}

function reportLeg(leg: DetectedSailedLeg) {
  const approaches = manifest.marks
    .map(mark => {
      const { metres, timestamp } = closestApproach(
        mark,
        fixes.filter(fix => fix.timestamp >= leg.startTime && fix.timestamp < leg.endTime),
      );
      return `${mark.name}#${mark.id} ${Number.isFinite(metres) ? `${Math.round(metres)}m@${clock(timestamp)}` : 'no fix'}`;
    })
    .join('  ');
  return [
    `leg ${leg.ordinal} "${leg.name}" → mark ${leg.courseMarkId ?? '—'}`,
    `  ${clock(leg.startTime)} → ${clock(leg.endTime)}  ${minutes(leg.endTime - leg.startTime)}` +
      `  median |TWA| ${leg.medianAbsTwa.toFixed(1)}°${leg.continuation ? '  (continuation)' : ''}`,
    `  closest in leg: ${approaches}`,
  ].join('\n');
}

/** The boundaries detection actually produced, including the session edges. */
const detectedBoundaries = [
  ...result.sailedLegs.map(leg => leg.startTime),
  result.sailedLegs.at(-1)?.endTime ?? 0,
];

const nearestDetected = (boundary: number) =>
  detectedBoundaries.reduce((best, at) =>
    Math.abs(at - boundary) < Math.abs(best - boundary) ? at : best,
  );

describe('Saturday race replay harness', () => {
  it('reconstructs the race from the raw log the app recorded', () => {
    // Two and a quarter hours at 1 Hz. If this drops, the GPS-clock timing
    // reconstruction has broken, and every duration below is meaningless.
    expect(result.samples.length).toBeGreaterThan(7_000);
    const span = result.samples.at(-1)!.timestamp - result.samples[0].timestamp;
    expect(span).toBeGreaterThan(2 * 60 * 60_000);
    expect(fixes.length / result.samples.length).toBeGreaterThan(0.9);
    // Sample timestamps are the boat's own clock, not a replay-relative offset.
    // The first sample lands inside the log's first GPS second, not exactly on
    // it: the burst for that second is spread across it in arrival order.
    expect(result.samples[0].timestamp).toBeGreaterThanOrEqual(Date.UTC(2026, 7, 15, 0, 36, 44));
    expect(result.samples[0].timestamp).toBeLessThan(Date.UTC(2026, 7, 15, 0, 36, 45));
  });

  it('reports what leg detection made of a seven-leg course', () => {
    const gaps = result.samples
      .map((sample, index) => (index === 0 ? 0 : sample.timestamp - result.samples[index - 1].timestamp))
      .filter(gap => gap > 5_000);

    const report = [
      `course "${manifest.courseName}": ${manifest.marks.length} marks, ${manifest.legCount} legs`,
      `samples ${result.samples.length} (${fixes.length} with a fix), ` +
        `${clock(result.samples[0].timestamp)} → ${clock(result.samples.at(-1)!.timestamp)}`,
      `wind frame ${result.windFrame}; data gaps over 5 s: ${gaps.length}` +
        (gaps.length ? ` (longest ${minutes(Math.max(...gaps))})` : ''),
      `median TWS ${median(result.samples.flatMap(s => (s.tws === null ? [] : [s.tws]))).toFixed(1)} kn`,
      `rejects ${JSON.stringify(result.health.rejects)}`,
      '',
      `DETECTED ${result.sailedLegs.length} legs of ${manifest.legCount}:`,
      ...result.sailedLegs.map(reportLeg),
      '',
      'SAILED TRUTH vs the nearest boundary median |TWA| found:',
      ...manifest.roundings.map(rounding => {
        const at = Date.parse(rounding.at);
        const nearest = nearestDetected(at);
        const delta = (nearest - at) / 1_000;
        return (
          `  ${clock(at)} ${rounding.name}#${rounding.courseMarkId} (${rounding.metres}m)` +
          `  nearest detected ${clock(nearest)} — ${delta > 0 ? '+' : ''}${delta.toFixed(0)}s` +
          `${Math.abs(delta) > 120 ? '   ← MISSED' : ''}`
        );
      }),
      '',
      'GREEDY SEQUENTIAL CLOSEST APPROACH per course mark — the naive course',
      'anchoring, shown because it does *not* reproduce the truth above:',
      ...sequentialRoundings().map(
        ({ mark, metres, timestamp }) =>
          `  ${mark.name}#${mark.id}${mark.direction ? ` (${mark.direction})` : ''}` +
          `  ${Number.isFinite(metres) ? `${Math.round(metres)}m at ${clock(timestamp)}` : 'never approached'}`,
      ),
    ].join('\n');
    console.log(report);

    // Whatever the count, every leg must be filed under a real course mark and
    // carry a usable median — misfiled data was the second symptom in ticket 22.
    for (const leg of result.sailedLegs) {
      expect(manifest.marks.some(mark => mark.id === leg.courseMarkId)).toBe(true);
      expect(Number.isFinite(leg.medianAbsTwa)).toBe(true);
    }
  });

  it('grounds the manifest truth in the track, in course order', () => {
    // The truth is only as good as the log it was read off. Every rounding must
    // still be the nearest the boat came to that mark around that time, and the
    // eight must stay in course order — otherwise the fixture asserts fiction.
    let previous = 0;
    for (const rounding of manifest.roundings) {
      const at = Date.parse(rounding.at);
      const mark = manifest.marks.find(item => item.id === rounding.courseMarkId)!;
      const window = fixes.filter(fix => Math.abs(fix.timestamp - at) <= 60_000);
      const approach = closestApproach(mark, window);
      expect(Math.round(approach.metres)).toBe(rounding.metres);
      expect(Math.abs(approach.timestamp - at)).toBeLessThanOrEqual(1_000);
      expect(at).toBeGreaterThan(previous);
      previous = at;
    }
    expect(manifest.sailedLegs).toHaveLength(manifest.legCount);
  });

  it('detectsTheSailedLegs', () => {
    // The truth, on the real race. Ticket 21 recorded the defect here — nine
    // legs for a seven-leg course, five of eight roundings found and every leg
    // after the first miss misnamed. Ticket 22 anchored detection on the marks,
    // and these are the manifest's own numbers.
    expect(result.sailedLegs).toHaveLength(manifest.legCount);

    expect(
      result.sailedLegs.map(leg => ({
        ordinal: leg.ordinal,
        name: leg.name,
        courseMarkId: leg.courseMarkId,
      })),
    ).toEqual(
      manifest.sailedLegs.map(leg => ({
        ordinal: leg.ordinal,
        name: leg.name,
        courseMarkId: leg.courseMarkId,
      })),
    );

    // Boundaries within a minute of when the boat was actually at the mark.
    for (const [index, leg] of result.sailedLegs.entries()) {
      const truth = manifest.sailedLegs[index];
      expect(Math.abs(leg.startTime - Date.parse(truth.startTime))).toBeLessThanOrEqual(60_000);
      expect(Math.abs(leg.endTime - Date.parse(truth.endTime))).toBeLessThanOrEqual(60_000);
    }

    // Every rounding, including the two the |TWA| path could not see: North
    // Head#7 inside a 21-minute run and Orakei#11 inside a 51-minute beat.
    for (const rounding of manifest.roundings) {
      const at = Date.parse(rounding.at);
      expect(Math.abs(nearestDetected(at) - at)).toBeLessThanOrEqual(60_000);
    }

    // The recording ran five minutes before the start and two past the finish,
    // and neither is a leg: the first leg starts at the first rounding and the
    // last ends at the finish, with no wrap-around leg back to the start.
    expect(result.sailedLegs[0].startTime).toBeGreaterThan(result.samples[0].timestamp);
    expect(result.sailedLegs.at(-1)!.endTime).toBeLessThan(result.samples.at(-1)!.timestamp);
  });
});
