/**
 * Ticket 24's prototype data extractor and steadiness-mask gate. Opt-in
 * (`.eval.ts` runs in no default suite):
 *
 *   npx jest -c jest.eval.config.js features/capture/eval/reviewPrototypeData
 *
 * Replays `saturday-race.log` through the shipped pipeline and writes
 * `.tickets/nmea-ingestion/prototypes/24-data.json`, which
 * `24-review-screen-shape.html` inlines. Re-run it and re-inline if the
 * detector changes what a leg is; the gate numbers it prints are recorded on
 * ticket 24.
 */
import fs from 'fs';
import path from 'path';
import { rawLogReplayInput } from '../util/rawLogReplay';
import { replayCaptureSession, type ReplayCaptureSample } from '../util/replayCaptureSession';
import { findSteadyStretches } from '../util/steadyState';
import { median } from '../util/statistics';
import type { SailedLegCourseMark } from '../util/sailedLegDetection';

/**
 * THROWAWAY — ticket 24's gate measurement and prototype data extractor.
 * Delete with the prototype. Measures how much of the real race
 * `findSteadyStretches` accepts, and writes the numbers the HTML variants draw.
 */

const fixtureDirectory = path.resolve(
  process.cwd(),
  'features/capture/util/__tests__/fixtures',
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(fixtureDirectory, 'saturday-race.manifest.json'), 'utf8'),
) as { courseName: string; marks: (SailedLegCourseMark & { markId: number; latitude: number; longitude: number })[] };
const log = fs.readFileSync(path.join(fixtureDirectory, 'saturday-race.log'), 'utf8');

const result = replayCaptureSession({
  ...rawLogReplayInput(log),
  courseMarks: manifest.marks,
});

const round = (value: number, places = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(places)) : null;

describe('prototype 24 data', () => {
  it('measures the steadiness mask against the real race and writes the variants data', () => {
    const samples = result.samples;
    const lines: string[] = [];
    const legs = result.sailedLegs.map(leg => {
      const legSamples = samples.filter(
        sample => sample.timestamp >= leg.startTime && sample.timestamp < leg.endTime,
      );
      const stretches = findSteadyStretches(legSamples);
      const covered = stretches.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
      const speeds = legSamples.flatMap(s => (s.stw === null ? [] : [s.stw]));
      const twss = legSamples.flatMap(s => (s.tws === null ? [] : [s.tws]));
      return { leg, legSamples, stretches, covered, speeds, twss };
    });

    const totalLegMs = legs.reduce((sum, l) => sum + (l.leg.endTime - l.leg.startTime), 0);
    const totalCovered = legs.reduce((sum, l) => sum + l.covered, 0);

    lines.push('=== STEADINESS-MASK GATE (ticket 24) ===');
    lines.push(`session ${result.samples.length} samples, windFrame ${result.windFrame}`);
    lines.push(
      `legs ${legs.length}; leg time ${(totalLegMs / 60000).toFixed(1)} min; ` +
      `steady time ${(totalCovered / 60000).toFixed(1)} min; ` +
      `coverage ${((totalCovered / totalLegMs) * 100).toFixed(1)}% of leg time`,
    );
    lines.push(`legs with zero steady stretches: ${legs.filter(l => l.stretches.length === 0).length}`);
    lines.push('');
    for (const l of legs) {
      const ms = l.leg.endTime - l.leg.startTime;
      lines.push(
        `  leg ${l.leg.ordinal} "${l.leg.name}" ${l.legSamples.length} samples, ` +
        `${(ms / 60000).toFixed(1)} min — ${l.stretches.length} stretches, ` +
        `${(l.covered / 1000).toFixed(0)} s steady (${((l.covered / ms) * 100).toFixed(1)}%), ` +
        `max stw ${Math.max(...l.speeds).toFixed(1)} kn`,
      );
    }
    console.log(lines.join('\n'));

    // Prototype payload: real names, counts, traces, spans, stretches, track.
    const stride = (count: number, wanted: number) => Math.max(1, Math.ceil(count / wanted));
    const payload = {
      generatedFrom: 'saturday-race.log',
      course: manifest.courseName,
      session: {
        startedAt: samples[0].timestamp,
        endedAt: samples.at(-1)!.timestamp,
        durationMs: samples.at(-1)!.timestamp - samples[0].timestamp,
        sampleCount: samples.length,
        windFrame: result.windFrame,
        rejects: result.health.rejects,
        stale: result.health.stale,
        medianTws: round(median(samples.flatMap(s => (s.tws === null ? [] : [s.tws])))),
        minTws: round(Math.min(...samples.flatMap(s => (s.tws === null ? [] : [s.tws])))),
        maxTws: round(Math.max(...samples.flatMap(s => (s.tws === null ? [] : [s.tws])))),
      },
      marks: manifest.marks.map(m => ({ id: m.id, name: m.name, lat: m.latitude, lon: m.longitude })),
      steadyGate: {
        legCount: legs.length,
        legMinutes: round(totalLegMs / 60000, 1),
        steadyMinutes: round(totalCovered / 60000, 1),
        coveragePercent: round((totalCovered / totalLegMs) * 100, 1),
        legsWithNoStretch: legs.filter(l => l.stretches.length === 0).length,
      },
      legs: legs.map(l => {
        // [seconds into the leg, stw or null] — pairs, not a bare series, so a
        // dropout lifts the pen at the right place instead of shifting time.
        const s = stride(l.legSamples.length, 1_200);
        const trace: [number, number | null][] = [];
        for (let i = 0; i < l.legSamples.length; i += s) {
          const sample = l.legSamples[i];
          trace.push([
            round((sample.timestamp - l.leg.startTime) / 1000, 1)!,
            sample.stw === null ? null : round(sample.stw, 2),
          ]);
        }
        const t = stride(l.legSamples.length, 160);
        const track: [number, number][] = [];
        for (let i = 0; i < l.legSamples.length; i += t) {
          const sample = l.legSamples[i];
          if (sample.lat !== null && sample.lon !== null) track.push([round(sample.lat, 5)!, round(sample.lon, 5)!]);
        }
        return {
          ordinal: l.leg.ordinal,
          name: l.leg.name,
          courseMarkId: l.leg.courseMarkId,
          startTime: l.leg.startTime,
          endTime: l.leg.endTime,
          durationMs: l.leg.endTime - l.leg.startTime,
          sampleCount: l.legSamples.length,
          medianAbsTwa: round(l.leg.medianAbsTwa, 1),
          medianTws: round(median(l.twss), 1),
          maxStw: round(Math.max(...l.speeds), 1),
          minStw: round(Math.min(...l.speeds), 1),
          spans: l.leg.draftSpans.map(span => ({
            startTime: span.startTime,
            endTime: span.endTime,
            sailId: span.sailId,
            gap: span.gap === true,
          })),
          steady: l.stretches.map(st => ({
            startTime: st.startTime,
            endTime: st.endTime,
            medianBoatSpeed: round(st.medianBoatSpeed, 2),
            medianTws: round(st.medianTws, 1),
            medianAbsTwa: round(st.medianAbsTwa, 1),
          })),
          traceStrideMs: s * 1000,
          trace,
          track,
        };
      }),
    };
    const out = path.resolve(process.cwd(), '../.tickets/nmea-ingestion/prototypes/24-data.json');
    fs.writeFileSync(out, JSON.stringify(payload));
    console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} kB)`);

    expect(legs.length).toBeGreaterThan(0);
  }, 120_000);
});
