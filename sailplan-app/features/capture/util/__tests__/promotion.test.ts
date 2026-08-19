import { reviewedSpans, proposePolarPoints } from '../promotion';
import type { ReplayCaptureSample } from '../replayCaptureSession';

const start = 1_700_000_000_000;

function samples({
  seconds,
  twa,
  tws = 12,
  stw = 6,
  hdg = 100,
  startSecond = 0,
  speedAt,
}: {
  seconds: number;
  twa: number;
  tws?: number;
  stw?: number;
  hdg?: number;
  startSecond?: number;
  speedAt?: (index: number) => number;
}): ReplayCaptureSample[] {
  return Array.from({ length: seconds }, (_, index) => ({
    timestamp: start + (startSecond + index) * 1_000,
    gpsTime: null,
    tws,
    twa,
    twd: null,
    stw: speedAt ? speedAt(index) : stw,
    sog: null,
    cog: null,
    hdg,
    variation: null,
    awa: null,
    aws: null,
    heel: null,
    trim: null,
    lat: null,
    lon: null,
    rawOffset: null,
  }));
}

const wholeLeg = (sailId: number | null, seconds: number, legOrdinal = 1) => [
  { legOrdinal, startTime: start, endTime: start + seconds * 1_000, sailId },
];

describe('proposePolarPoints', () => {
  it('emits one point at the bin centres of the clustered grid', () => {
    const points = proposePolarPoints(
      samples({ seconds: 120, twa: 41.4, tws: 11.6, stw: 6.4 }),
      wholeLeg(7, 120),
    );

    expect(points).toEqual([
      {
        legOrdinal: 1,
        sailId: 7,
        tws: 12,
        twa: 40,
        speed: 6.4,
        sampleCount: 120,
        retainedCount: 120,
      },
    ]);
  });

  it('proposes nothing from a bin with fewer than thirty qualifying samples', () => {
    const points = proposePolarPoints(
      samples({ seconds: 29, twa: 40, tws: 12 }),
      wholeLeg(7, 29),
    );
    expect(points).toEqual([]);
  });

  it('counts evidence before outlier cleanup, not after', () => {
    // A one-sample glitch: the 3 s rolling median absorbs it, so the stretch
    // stays steady and the bin still holds thirty qualifying samples. Cleanup
    // then drops the glitch — after the bin has earned its point, not before.
    const points = proposePolarPoints(
      samples({
        seconds: 30,
        twa: 40,
        speedAt: index => (index === 5 ? 30 : 6),
      }),
      wholeLeg(7, 30),
    );
    expect(points).toHaveLength(1);
    expect(points[0].speed).toBe(6);
    expect(points[0].sampleCount).toBe(30);
    expect(points[0].retainedCount).toBe(29);
  });

  it('keeps every reading of a quantised bin whose deviation is zero', () => {
    // MAD is 0 here, so without the 0.1 kn wire-resolution floor the median
    // rejects every reading that is not identical to it.
    const points = proposePolarPoints(
      samples({
        seconds: 40,
        twa: 40,
        speedAt: index => (index < 30 ? 6 : 6.1),
      }),
      wholeLeg(7, 40),
    );
    expect(points[0].retainedCount).toBe(40);
  });

  it('merges port and starboard into one bin at the absolute angle', () => {
    const points = proposePolarPoints(
      [
        ...samples({ seconds: 20, twa: 40, stw: 6 }),
        ...samples({ seconds: 20, twa: -40, stw: 6.2, startSecond: 20 }),
      ],
      wholeLeg(7, 40),
    );
    expect(points).toHaveLength(1);
    expect(points[0].twa).toBe(40);
    expect(points[0].sampleCount).toBe(40);
  });

  it('takes nothing from a span with no sail on it', () => {
    expect(proposePolarPoints(samples({ seconds: 120, twa: 40 }), wholeLeg(null, 120))).toEqual([]);
  });

  it('takes nothing from samples outside every span', () => {
    const points = proposePolarPoints(samples({ seconds: 120, twa: 40 }), [
      { legOrdinal: 1, startTime: start + 200_000, endTime: start + 300_000, sailId: 7 },
    ]);
    expect(points).toEqual([]);
  });

  it('takes nothing from a stretch the boat was never settled through', () => {
    // A heading sweeping a degree a second never holds the +/-5 degree band.
    const points = proposePolarPoints(
      samples({ seconds: 120, twa: 40 }).map((sample, index) => ({
        ...sample,
        hdg: (100 + index) % 360,
      })),
      wholeLeg(7, 120),
    );
    expect(points).toEqual([]);
  });

  it('keeps each leg its own evidence rather than pooling the race', () => {
    // Two legs in identical conditions, neither reaching thirty samples on its
    // own. Pooling them would manufacture a point out of two half-cases.
    const points = proposePolarPoints(
      [
        ...samples({ seconds: 20, twa: 40 }),
        ...samples({ seconds: 20, twa: 40, startSecond: 40 }),
      ],
      [
        { legOrdinal: 1, startTime: start, endTime: start + 20_000, sailId: 7 },
        { legOrdinal: 2, startTime: start + 40_000, endTime: start + 60_000, sailId: 7 },
      ],
    );
    expect(points).toEqual([]);
  });

  it('separates sails sailed through the same conditions', () => {
    const points = proposePolarPoints(
      [
        ...samples({ seconds: 40, twa: 40, stw: 6 }),
        ...samples({ seconds: 40, twa: 40, stw: 6.5, startSecond: 40 }),
      ],
      [
        { legOrdinal: 1, startTime: start, endTime: start + 40_000, sailId: 7 },
        { legOrdinal: 1, startTime: start + 40_000, endTime: start + 80_000, sailId: 8 },
      ],
    );
    expect(points.map(point => [point.sailId, point.speed])).toEqual([
      [7, 6],
      [8, 6.5],
    ]);
  });
});

describe('reviewedSpans', () => {
  const leg = (overrides: Partial<Parameters<typeof reviewedSpans>[0][number]>) => ({
    ordinal: 1,
    reviewedAt: 1_000,
    used: true,
    sailSpans: [{ startTime: start, endTime: start + 60_000, sailId: 7 }],
    ...overrides,
  });

  it('takes the spans of a reviewed leg the sailor kept', () => {
    expect(reviewedSpans([leg({})])).toEqual([
      { legOrdinal: 1, startTime: start, endTime: start + 60_000, sailId: 7 },
    ]);
  });

  it('takes nothing from a leg the sailor has not reviewed', () => {
    expect(reviewedSpans([leg({ reviewedAt: null })])).toEqual([]);
  });

  it('takes nothing from a leg struck out of the polar', () => {
    expect(reviewedSpans([leg({ used: false })])).toEqual([]);
  });

  it('keeps the parts of a gap-split leg under one ordinal', () => {
    const spans = reviewedSpans([
      leg({}),
      leg({ sailSpans: [{ startTime: start + 90_000, endTime: start + 150_000, sailId: 7 }] }),
    ]);
    expect(spans.map(span => span.legOrdinal)).toEqual([1, 1]);
  });
});
