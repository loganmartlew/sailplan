import type { ReplayCaptureSample } from '../replayCaptureSession';
import { findSteadyStretches, STEADY_MIN_MS } from '../steadyState';

const SESSION_START = 1_700_000_000_000;

/**
 * Steady sailing, one sample per `cadence`, with `jitter` added to each
 * arrival. Real capture timestamps are `Math.round(sessionStartWallClock + at)`
 * where `at` is wire-arrival time — they are never on a 1 s grid, so a fixture
 * that only ever ticks at exactly 1000 ms cannot catch a window test that
 * demands an exact span.
 */
function steadySailing({
  count = 60,
  cadence = 1_000,
  jitter = () => 0,
  stw = 6,
}: {
  count?: number;
  cadence?: number;
  jitter?: (index: number) => number;
  stw?: number | ((index: number) => number);
} = {}): ReplayCaptureSample[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: SESSION_START + index * cadence + jitter(index),
    tws: 12,
    twa: 45,
    stw: typeof stw === 'function' ? stw(index) : stw,
    hdg: 300,
  })) as unknown as ReplayCaptureSample[];
}

const JITTER = [3, -5, 7, -2, 6, -6, 1, 4, -3, 2];

describe('findSteadyStretches', () => {
  it('finds a stretch in clean 1 Hz data', () => {
    expect(findSteadyStretches(steadySailing())).toHaveLength(1);
  });

  it('finds a stretch despite millisecond arrival jitter', () => {
    const stretches = findSteadyStretches(
      steadySailing({ jitter: index => JITTER[index % JITTER.length] }),
    );

    expect(stretches).toHaveLength(1);
    expect(stretches[0].endTime - stretches[0].startTime).toBeGreaterThanOrEqual(STEADY_MIN_MS);
  });

  it('finds a stretch at a cadence that is not 1 Hz', () => {
    expect(findSteadyStretches(steadySailing({ cadence: 1_100 }))).toHaveLength(1);
    expect(findSteadyStretches(steadySailing({ cadence: 700, count: 90 }))).toHaveLength(1);
  });

  it('reports the sailing conditions it measured', () => {
    const [stretch] = findSteadyStretches(
      steadySailing({ jitter: index => JITTER[index % JITTER.length] }),
    );

    expect(stretch.medianBoatSpeed).toBeCloseTo(6);
    expect(stretch.medianTws).toBeCloseTo(12);
    expect(stretch.medianAbsTwa).toBeCloseTo(45);
  });

  it('finds nothing in a run too short to qualify', () => {
    expect(findSteadyStretches(steadySailing({ count: 10 }))).toHaveLength(0);
  });

  it('finds nothing while boat speed is still climbing', () => {
    expect(
      findSteadyStretches(steadySailing({ stw: index => 3 + index * 0.2 })),
    ).toHaveLength(0);
  });

  it('splits a stretch at a gap in the data', () => {
    const before = steadySailing({ count: 30 });
    const after = steadySailing({ count: 30 }).map(sample => ({
      ...sample,
      timestamp: sample.timestamp + 30_000 + 60_000,
    }));

    expect(findSteadyStretches([...before, ...after])).toHaveLength(2);
  });
});
