import fs from 'fs';
import path from 'path';
import {
  classifyWindFrame,
  replayCaptureSession,
  type ReplayCaptureSample,
  type TimedNmeaChunk,
} from '../replayCaptureSession';

function checksum(body: string): string {
  let value = 0;
  for (let index = 0; index < body.length; index += 1) value ^= body.charCodeAt(index);
  return value.toString(16).toUpperCase().padStart(2, '0');
}

const sentence = (body: string) => `$${body}*${checksum(body)}`;
const at = (monotonicElapsedMs: number, ...texts: string[]): TimedNmeaChunk => ({
  monotonicElapsedMs,
  chunk: `${texts.join('\r\n')}\r\n`,
});
const start = 1_700_000_000_000;

describe('replayCaptureSession', () => {
  it('returns sailed legs from the same replay entry point', () => {
    const sentences = Array.from({ length: 600 }, (_, second) =>
      at(
        second * 1_000,
        sentence(`WIMWV,${second < 300 ? '45.0' : '135.0'},T,12.0,N,A`),
      ),
    );

    const result = replayCaptureSession({ sessionStartWallClock: start, sentences });

    expect(result.sailedLegs).toHaveLength(2);
    expect(result.sailedLegs.map(leg => leg.name)).toEqual(['Beat 1', 'Run 2']);
  });

  it('detects 20 sailed legs in the windward-leeward simulator race without splitting its tacks', () => {
    // Compact deterministic fixture generated from scripts/wl-race.json; it
    // retains the 1 Hz true-wind sentence and TAG timestamp from each second.
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [fs.readFileSync(path.join(__dirname, 'fixtures/wl-race-true-wind.log'), 'utf8')],
    });

    expect(result.sailedLegs).toHaveLength(20);
    expect(result.sailedLegs.map(leg => leg.name)).toEqual(
      Array.from({ length: 20 }, (_, index) => `${index % 2 === 0 ? 'Beat' : 'Run'} ${index + 1}`),
    );
  }, 30_000);

  it('coalesces both anchor types into true 1 Hz measurement rows', () => {
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('SDHDG,100.0,,,20.0,E')),
        at(20, sentence('WIMWV,315.5,R,8.0,N,A')),
        at(40, sentence('WIMWV,320.25,T,12.4,N,A')),
        at(100, sentence('SDVHW,120.0,T,100.0,M,6.25,N,11.6,K')),
        at(180, sentence('WIMWD,220.25,T,200.25,M,12.4,N,6.4,M')),
        at(1_000, sentence('WIMWV,321.25,T,12.5,N,A')),
        at(1_080, sentence('SDVHW,121.0,T,101.0,M,6.5,N,12.0,K')),
        at(2_000, sentence('WIMWV,322.25,T,12.6,N,A')),
      ],
    });

    expect(result.samples).toHaveLength(3);
    expect(result.samples[0]).toMatchObject({ timestamp: start + 40, tws: 12.4, twa: -39.75, twd: 220.25, stw: 6.25, hdg: 120, variation: 20, awa: -44.5, aws: 8 });
    expect(result.samples.map(sample => sample.timestamp)).toEqual([start + 40, start + 1_000, start + 2_000]);
  });

  it('validates before conversion, rejects status V, and isolates corrupt non-anchor fields', () => {
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('WIMWV,45.0,T,18.52,K,A')),
        at(50, sentence('IIXDR,A,4.2,D,HEEL,A,-1.-3,D,TRIM,P,1.016,B,BARO')),
        at(1_000, sentence('WIMWV,,T,,,V')),
        at(2_000, sentence('WIMWV,46.0,T,10.0,N,A')),
      ],
    });

    expect(result.samples).toHaveLength(2);
    expect(result.samples[0]).toMatchObject({ tws: 10, twa: 45, heel: 4.2, trim: null });
    expect(result.health.rejects).toMatchObject({ MWV: 1, XDR: 1 });
  });

  it('rejects the whole pending row when its true-wind anchor is corrupt', () => {
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('SDVHW,40.0,T,40.0,M,6.0,N,11.1,K')),
        at(100, sentence('WIMWV,,T,,,V')),
        at(1_000, sentence('WIMWV,42.0,T,12.0,N,A')),
      ],
    });
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].timestamp).toBe(start + 1_000);
  });

  it('keeps a pending row whose corrupt MWV is relative, not the anchor', () => {
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('WIMWV,42.0,T,12.0,N,A')),
        // Checksum-failed relative wind whose corruption happens to contain
        // `,T,`. Only a true-wind MWV is the anchor, so the row still stands.
        at(100, '$WIMWV,31.0,R,,T,,8.0,N,A*00'),
      ],
    });
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]).toMatchObject({ tws: 12, twa: 42 });
  });

  it('reads VTG with and without the mode indicator, and checks its units', () => {
    const withMode = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('GPVTG,89.5,T,69.5,M,6.4,N,11.9,K,A')),
        at(50, sentence('WIMWV,42.0,T,12.0,N,A')),
      ],
    });
    // Pre-NMEA-2.3 talkers omit the mode field entirely.
    const legacy = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('GPVTG,89.5,T,69.5,M,6.4,N,11.9,K')),
        at(50, sentence('WIMWV,42.0,T,12.0,N,A')),
      ],
    });
    // One field out of register: the magnetic unit is no longer where it
    // belongs, so the true and magnetic halves cannot be told apart.
    const shifted = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('GPVTG,89.5,T,69.5,X,6.4,N,11.9,K,A')),
        at(50, sentence('WIMWV,42.0,T,12.0,N,A')),
      ],
    });

    expect(withMode.samples[0]).toMatchObject({ cog: 89.5, sog: 6.4 });
    expect(legacy.samples[0]).toMatchObject({ cog: 89.5, sog: 6.4 });
    expect(shifted.samples[0]).toMatchObject({ cog: null, sog: null });
    expect(shifted.health.rejects).toMatchObject({ VTG: 1 });
  });

  it('emits whole-millisecond timestamps for the INTEGER sample column', () => {
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        { chunk: `${sentence('WIMWV,42.0,T,12.0,N,A')}\r\n`, monotonicElapsedMs: 40.6180419921875 },
      ],
    });
    expect(result.samples).toHaveLength(1);
    expect(Number.isInteger(result.samples[0].timestamp)).toBe(true);
    expect(result.samples[0].timestamp).toBe(start + 41);
  });

  it('keeps valid fields from a partially corrupt non-anchor sentence', () => {
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        at(0, sentence('GPRMC,010000.00,A,NOPE,S,17446.5720,E,5.8,180.0,300626,21.5,E,A')),
        at(20, sentence('WIMWV,40.0,T,12.0,N,A')),
      ],
    });
    expect(result.samples[0]).toMatchObject({
      lat: null,
      lon: 174.7762,
      sog: 5.8,
      cog: 180,
      variation: 21.5,
    });
    expect(result.health.rejects.RMC).toBe(1);
  });

  it('TTL-nulls a stale field without costing intact wind rows', () => {
    const chunks: TimedNmeaChunk[] = [at(0, sentence('WIMWV,40.0,T,12.0,N,A')), at(50, sentence('SDVHW,40.0,T,40.0,M,6.0,N,11.1,K'))];
    for (let second = 1; second <= 93; second += 1) chunks.push(at(second * 1_000, sentence('WIMWV,40.0,T,12.0,N,A')));
    const result = replayCaptureSession({ sessionStartWallClock: start, sentences: chunks });
    const staleRows = result.samples.filter(sample => sample.timestamp >= start + 4_000 && sample.stw === null);
    expect(staleRows).toHaveLength(90);
    expect(staleRows.every(sample => sample.tws === 12)).toBe(true);
    expect(result.health.stale.stw).toBe(90);
  });

  it('counts over-length lines but accepts them when otherwise valid', () => {
    const result = replayCaptureSession({ sessionStartWallClock: start, sentences: [at(0, `${sentence('WIMWV,40.0,T,12.0,N,A')}${' '.repeat(90)}`)] });
    expect(result.health.overLengthLines).toBe(1);
    expect(result.samples).toHaveLength(1);
  });

  it('reassembles TCP chunks and rejects a truncated sentence rather than shifting fields', () => {
    const valid = `${sentence('WIMWV,40.0,T,12.0,N,A')}\r\n`;
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: [
        { monotonicElapsedMs: 0, chunk: valid.slice(0, 12) },
        { monotonicElapsedMs: 10, chunk: valid.slice(12) },
        at(1_000, '$WIMWV,41.0,T'),
        at(2_000, sentence('WIMWV,42.0,T,13.0,N,A')),
      ],
    });
    expect(result.samples.map(sample => sample.twa)).toEqual([40, 42]);
    expect(result.health.rejects.MWV).toBe(1);
  });

  it('does not manufacture rows across a dropout', () => {
    const result = replayCaptureSession({ sessionStartWallClock: start, sentences: [at(0, sentence('WIMWV,40.0,T,12.0,N,A')), at(1_000, sentence('WIMWV,40.0,T,12.0,N,A')), at(12_000, sentence('WIMWV,40.0,T,12.0,N,A'))] });
    expect(result.samples.map(sample => sample.timestamp)).toEqual([start, start + 1_000, start + 12_000]);
  });

  it('leaves an indistinguishable simulator wind frame unknown without blending it', () => {
    const fixtureDirectory = path.resolve(
      process.cwd(),
      'features/capture/util/__tests__/fixtures',
    );
    const log = fs.readFileSync(
      path.join(fixtureDirectory, 'simulator-race.log'),
      'utf8',
    );
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(fixtureDirectory, 'simulator-race.manifest.json'),
        'utf8',
      ),
    ) as { truth: { stw: number }[] };
    const result = replayCaptureSession({
      sessionStartWallClock: start,
      sentences: log.split(/(?<=\n)/),
    });
    expect(result.samples).toHaveLength(20);
    expect(result.samples[10].stw).toBeCloseTo(manifest.truth[10].stw, 1);
    // With no current in this fixture, water and ground derivations are
    // indistinguishable; the classifier must say so rather than inventing one.
    expect(result.windFrame).toBe('unknown');
    expect(result.samples.every(sample => sample.tws === null || sample.tws < 20)).toBe(true);
  });

  it('survives the real Navico stream and records its known malformed evidence', () => {
    const log = fs.readFileSync(path.resolve(process.cwd(), '../nmea-sim/logs/gofree-merrimac.log'), 'utf8');
    const result = replayCaptureSession({ sessionStartWallClock: start, assumedSentencePeriodMs: 100, sentences: [log] });
    expect(result.samples.length).toBeGreaterThan(100);
    expect(result.health.rejects.VLW).toBe(142);
    expect(result.health.overLengthLines).toBe(331);
    expect(result.samples.some(sample => sample.heel !== null)).toBe(true);
    expect(result.samples.every(sample => sample.trim === null)).toBe(true);
  });
});

function sample(overrides: Partial<ReplayCaptureSample>): ReplayCaptureSample {
  return {
    timestamp: start, gpsTime: null, tws: 12, twa: 45, twd: null,
    stw: 5, sog: 8, cog: 75, hdg: 45, variation: null,
    awa: 32.16, aws: 15.93, heel: null, trim: null, lat: null,
    lon: null, rawOffset: null, ...overrides,
  };
}

describe('classifyWindFrame', () => {
  it('distinguishes water- and ground-referenced instrument wind', () => {
    const water = Array.from({ length: 10 }, (_, index) => sample({ timestamp: start + index * 1_000 }));
    const ground = Array.from({ length: 10 }, (_, index) => sample({
      timestamp: start + index * 1_000,
      // Apparent vector = 12 kn true at 45 degrees + 8 kn ground
      // velocity 30 degrees to starboard of the bow.
      awa: 39.0083,
      aws: 19.8358,
    }));
    expect(classifyWindFrame(water)).toBe('water');
    expect(classifyWindFrame(ground)).toBe('ground');
  });

  it('recognises a TWA-dependent instrument correction rather than blending it', () => {
    const corrected = Array.from({ length: 30 }, (_, index) => {
      const trueAngle = 30 + index * 4;
      const trueSpeed = 12;
      const stw = 5;
      const x = trueSpeed * Math.sin((trueAngle * Math.PI) / 180);
      const y = trueSpeed * Math.cos((trueAngle * Math.PI) / 180) + stw;
      return sample({
        timestamp: start + index * 1_000,
        twa: trueAngle,
        tws: trueSpeed - trueAngle * 0.05,
        awa: (Math.atan2(x, y) * 180) / Math.PI,
        aws: Math.hypot(x, y),
      });
    });
    expect(classifyWindFrame(corrected)).toBe('instrument-corrected');
  });
});
