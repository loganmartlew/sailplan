import {
  detectSailedLegs,
  type SailedLegCourseMark,
} from '../sailedLegDetection';
import type { ReplayCaptureSample } from '../replayCaptureSession';

const start = 1_700_000_000_000;

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

  it('uses linked course mark pairs and creates guarded draft spans', () => {
    const courseMarks: SailedLegCourseMark[] = [
      { id: 11, name: 'Start' },
      { id: 12, name: 'Windward' },
      { id: 13, name: 'Leeward' },
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
