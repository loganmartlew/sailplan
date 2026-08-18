import {
  detectSailedLegs,
  type SailedLegCourseMark,
} from '../sailedLegDetection';
import type { ReplayCaptureSample } from '../replayCaptureSession';

const start = 1_700_000_000_000;

/** Metres north / east of an origin, in degrees, near 36°S. */
const METRE_LAT = 1 / 111_320;
const METRE_LON = 1 / (111_320 * Math.cos((36.8 * Math.PI) / 180));
const ORIGIN = { latitude: -36.8, longitude: 174.8 };

const at = (north: number, east: number) => ({
  latitude: ORIGIN.latitude + north * METRE_LAT,
  longitude: ORIGIN.longitude + east * METRE_LON,
});

const courseMarkAt = (
  id: number,
  name: string,
  north: number,
  east: number,
): SailedLegCourseMark => ({ id, name, ...at(north, east) });

/**
 * A sailed track: one fix a second, straight between the given points, each
 * stretch held at its own TWA. The positions are what course anchoring reads
 * and the TWA is what the fallback segmenter reads, so a test can hold one
 * still and move the other.
 */
function trackSamples(
  from: { north: number; east: number },
  stretches: readonly { north: number; east: number; twa: number }[],
): ReplayCaptureSample[] {
  const STEP_METRES = 5;
  const samples: ReplayCaptureSample[] = [];
  let previous = from;
  let second = 0;
  for (const stretch of stretches) {
    const span = Math.hypot(stretch.north - previous.north, stretch.east - previous.east);
    const steps = Math.max(1, Math.round(span / STEP_METRES));
    for (let step = 0; step < steps; step += 1) {
      const fraction = step / steps;
      const position = at(
        previous.north + (stretch.north - previous.north) * fraction,
        previous.east + (stretch.east - previous.east) * fraction,
      );
      samples.push({
        timestamp: start + second * 1_000,
        gpsTime: null, tws: 12, twa: stretch.twa, twd: null, stw: 6, sog: null,
        cog: null, hdg: null, variation: null, awa: null, aws: null, heel: null,
        trim: null, lat: position.latitude, lon: position.longitude, rawOffset: null,
      });
      second += 1;
    }
    previous = stretch;
  }
  return samples;
}

function samplesFor(
  stretches: readonly { seconds: number; twa: number | null }[],
): ReplayCaptureSample[] {
  let elapsed = 0;
  return stretches.flatMap(stretch => {
    const samples = Array.from({ length: stretch.seconds }, (_, second) => ({
      timestamp: start + (elapsed + second) * 1_000,
      gpsTime: null,
      tws: 12,
      twa: stretch.twa,
      twd: null,
      stw: 6,
      sog: null,
      cog: null,
      hdg: null,
      variation: null,
      awa: null,
      aws: null,
      heel: null,
      trim: null,
      lat: null,
      lon: null,
      rawOffset: null,
    }));
    elapsed += stretch.seconds;
    return samples;
  });
}

describe('detectSailedLegs', () => {
  it('finds a rounding from median absolute TWA without splitting tacks', () => {
    const samples = samplesFor([
      { seconds: 240, twa: 45 },
      { seconds: 240, twa: -45 },
      { seconds: 240, twa: -135 },
      { seconds: 240, twa: 135 },
    ]);

    const result = detectSailedLegs(samples);

    expect(result.map(leg => ({ ordinal: leg.ordinal, name: leg.name }))).toEqual([
      { ordinal: 1, name: 'Beat 1' },
      // The ordinal is 2 — this is the second leg — but it is the *first* run.
      { ordinal: 2, name: 'Run 1' },
    ]);
    expect(result[0].endTime).toBeGreaterThanOrEqual(start + 450_000);
    expect(result[0].endTime).toBeLessThanOrEqual(start + 510_000);
  });

  it('counts beats and runs in their own sequences', () => {
    // Spec §6 / story 48: "legs fall back to Beat 3 / Run 3" — the third beat
    // and the third run are each "3", so the name cannot be the leg ordinal.
    const samples = samplesFor([
      { seconds: 240, twa: 45 },
      { seconds: 240, twa: -135 },
      { seconds: 240, twa: -45 },
      { seconds: 240, twa: 135 },
      { seconds: 240, twa: 45 },
      { seconds: 240, twa: -135 },
    ]);

    expect(detectSailedLegs(samples).map(leg => leg.name)).toEqual([
      'Beat 1', 'Run 1', 'Beat 2', 'Run 2', 'Beat 3', 'Run 3',
    ]);
  });

  it('does not create a leg shorter than three minutes', () => {
    const samples = samplesFor([
      { seconds: 300, twa: 45 },
      { seconds: 120, twa: 135 },
      { seconds: 300, twa: 45 },
    ]);

    expect(detectSailedLegs(samples)).toHaveLength(1);
  });

  it('keeps a same-band dropout as two stored continuations with one presentation', () => {
    const before = samplesFor([{ seconds: 240, twa: 47 }]);
    const after = samplesFor([{ seconds: 240, twa: -43 }]).map(sample => ({
      ...sample,
      timestamp: sample.timestamp + 250_000,
    }));

    const result = detectSailedLegs([...before, ...after]);

    expect(result).toHaveLength(2);
    expect(result.map(leg => ({ ordinal: leg.ordinal, name: leg.name, continuation: leg.continuation }))).toEqual([
      { ordinal: 1, name: 'Beat 1', continuation: false },
      { ordinal: 1, name: 'Beat 1', continuation: true },
    ]);
  });

  it('names legs positionally and guards draft spans when the track has no fixes', () => {
    // No `lat`/`lon` anywhere in these samples, so there is nothing to anchor
    // to and detection stays on the `|TWA|` path, naming legs by position.
    const courseMarks: SailedLegCourseMark[] = [
      courseMarkAt(11, 'Start', 0, 0),
      courseMarkAt(12, 'Windward', 2_000, 0),
      courseMarkAt(13, 'Leeward', 0, 1_000),
    ];
    const samples = samplesFor([
      { seconds: 300, twa: 45 },
      { seconds: 300, twa: 135 },
    ]);

    const result = detectSailedLegs(samples, courseMarks);

    expect(result.map(leg => ({ name: leg.name, courseMarkId: leg.courseMarkId }))).toEqual([
      { name: 'Start → Windward', courseMarkId: 12 },
      { name: 'Windward → Leeward', courseMarkId: 13 },
    ]);
    expect(result[0].draftSpans).toEqual([
      { startTime: result[0].startTime, endTime: result[0].startTime + 25_000, sailId: null },
      { startTime: result[0].startTime + 25_000, endTime: result[0].endTime - 10_000, sailId: null },
      { startTime: result[0].endTime - 10_000, endTime: result[0].endTime, sailId: null },
    ]);
  });

});

describe('detectSailedLegs anchored on a linked course', () => {
  const marks = [
    courseMarkAt(1, 'Start', 0, 0),
    courseMarkAt(2, 'Windward', 2_000, 0),
    courseMarkAt(3, 'Wing', 2_000, 1_000),
    courseMarkAt(4, 'Finish', 0, 1_000),
  ];
  // Two consecutive legs sailed at the same point of sail, which is the case
  // the `|TWA|` segmenter cannot see: nothing in the trace marks the Windward
  // rounding. The recording also runs before the start and past the finish.
  const race = trackSamples(
    { north: -400, east: -400 },
    [
      { north: 0, east: 0, twa: 70 },
      { north: 2_000, east: 0, twa: 45 },
      { north: 2_000, east: 1_000, twa: 45 },
      { north: 0, east: 1_000, twa: 135 },
      { north: -400, east: 1_400, twa: 100 },
    ],
  );

  it('yields one leg per course leg, named for the marks the boat rounded', () => {
    const result = detectSailedLegs(race, marks);

    expect(result.map(leg => ({ ordinal: leg.ordinal, name: leg.name, courseMarkId: leg.courseMarkId }))).toEqual([
      { ordinal: 1, name: 'Start → Windward', courseMarkId: 2 },
      { ordinal: 2, name: 'Windward → Wing', courseMarkId: 3 },
      { ordinal: 3, name: 'Wing → Finish', courseMarkId: 4 },
    ]);
    // The same track without the course merges the two legs sailed at 45°,
    // which is the defect course anchoring exists to fix.
    expect(detectSailedLegs(race).length).toBeLessThan(result.length);
  });

  it('leaves pre-start and post-finish outside every leg', () => {
    const result = detectSailedLegs(race, marks);

    const nearest = (north: number, east: number) => {
      const mark = at(north, east);
      return race.reduce((best, sample) => {
        const metres = Math.hypot(
          (sample.lat! - mark.latitude) / METRE_LAT,
          (sample.lon! - mark.longitude) / METRE_LON,
        );
        return metres < best.metres ? { metres, timestamp: sample.timestamp } : best;
      }, { metres: Infinity, timestamp: 0 });
    };

    expect(result[0].startTime).toBe(nearest(0, 0).timestamp);
    expect(result.at(-1)!.endTime).toBe(nearest(0, 1_000).timestamp);
    expect(result[0].startTime).toBeGreaterThan(race[0].timestamp);
    expect(result.at(-1)!.endTime).toBeLessThan(race.at(-1)!.timestamp);
  });

  it('falls back to a |TWA| boundary for a mark the boat never came near', () => {
    const stale = [marks[0], marks[1], courseMarkAt(3, 'Stale', 40_000, 40_000), marks[3]];

    const result = detectSailedLegs(race, stale);

    // The Wing rounding is a 90° change of point of sail, so the segmenter can
    // supply the boundary the mark could not — and the leg keeps its name.
    expect(result.map(leg => leg.name)).toEqual([
      'Start → Windward',
      'Windward → Stale',
      'Stale → Finish',
    ]);
    const wing = race.find(sample => sample.twa === 135)!;
    expect(Math.abs(result[1].endTime - wing.timestamp)).toBeLessThan(90_000);
  });

  it('merges rather than invents a boundary when nothing marks the missed leg', () => {
    // Same missed mark, but the two legs either side of it were sailed at the
    // same point of sail, so there is no change to fall back to. One leg
    // between the marks that *were* rounded is the honest report.
    const straight = trackSamples(
      { north: -400, east: -400 },
      [
        { north: 0, east: 0, twa: 70 },
        { north: 2_000, east: 0, twa: 45 },
        { north: 2_000, east: 1_000, twa: 45 },
        { north: 0, east: 1_000, twa: 45 },
        { north: -400, east: 1_400, twa: 45 },
      ],
    );
    const stale = [marks[0], marks[1], courseMarkAt(3, 'Stale', 40_000, 40_000), marks[3]];

    expect(detectSailedLegs(straight, stale).map(leg => leg.name)).toEqual([
      'Start → Windward',
      'Windward → Finish',
    ]);
  });

  it('is unchanged when no course is linked', () => {
    expect(detectSailedLegs(race)).toEqual(detectSailedLegs(race, []));
  });
});
