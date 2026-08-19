/**
 * Why is the steadiness mask so sparse on a real race? Opt-in:
 *
 *   npx jest -c jest.eval.config.js features/capture/eval/steadinessProbe
 *
 * Reports which of `isSteady`'s three tests rejects each candidate window, and
 * what loosening each threshold would cost downstream in real polar points.
 * Findings are recorded on ticket 24 for `18` to act on. Carries a
 * parameterised re-implementation of `steadyState.ts` so thresholds can move;
 * it asserts against the shipped result to prove the copy still agrees.
 */
import fs from 'fs';
import path from 'path';
import { rawLogReplayInput } from '../util/rawLogReplay';
import { replayCaptureSession, type ReplayCaptureSample } from '../util/replayCaptureSession';
import { findSteadyStretches, STEADY_MIN_MS } from '../util/steadyState';
import { proposePolarPoints } from '../util/promotion';
import { median } from '../util/statistics';


const dir = path.resolve(process.cwd(), 'features/capture/util/__tests__/fixtures');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'saturday-race.manifest.json'), 'utf8'));
const result = replayCaptureSession({
  ...rawLogReplayInput(fs.readFileSync(path.join(dir, 'saturday-race.log'), 'utf8')),
  courseMarks: manifest.marks,
});

// ---- a parameterised re-implementation of steadyState.ts, so thresholds move
const R = 1_000;
const delta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const circMean = (v: number[]) => {
  const r = v.map(x => (x * Math.PI) / 180);
  return ((Math.atan2(r.reduce((s, x) => s + Math.sin(x), 0), r.reduce((s, x) => s + Math.cos(x), 0)) * 180) / Math.PI + 360) % 360;
};
const circMedian = (v: number[]) => [...v].sort((a, b) =>
  v.reduce((s, x) => s + Math.abs(delta(x, a)), 0) - v.reduce((s, x) => s + Math.abs(delta(x, b)), 0))[0];

type Smoothed = { timestamp: number; tws: number; boatSpeed: number; heading: number };
function smooth(samples: ReplayCaptureSample[]): Smoothed[] {
  let left = 0, right = 0;
  return samples.map((sample, index) => {
    while (samples[left].timestamp < sample.timestamp - R) left += 1;
    right = Math.max(right, index);
    while (right + 1 < samples.length && samples[right + 1].timestamp <= sample.timestamp + R) right += 1;
    const w = samples.slice(left, right + 1);
    return {
      timestamp: sample.timestamp,
      tws: median(w.map(x => x.tws!)),
      boatSpeed: median(w.map(x => x.stw!)),
      heading: circMedian(w.map(x => x.hdg!)),
    };
  });
}

function groupsOf(samples: readonly ReplayCaptureSample[]) {
  const complete = samples.filter(s => s.tws !== null && s.twa !== null && s.stw !== null && s.hdg !== null);
  const groups: ReplayCaptureSample[][] = [];
  for (const s of complete) {
    const g = groups.at(-1);
    if (!g || s.timestamp - g.at(-1)!.timestamp >= 2_000) groups.push([s]);
    else g.push(s);
  }
  return groups;
}

type Limits = { hdg: number; spd: number; tws: number };
const DEFAULT: Limits = { hdg: 5, spd: 0.05, tws: 1 };

function fails(window: Smoothed[], lim: Limits) {
  const h = circMean(window.map(s => s.heading));
  const b = window.reduce((s, x) => s + x.boatSpeed, 0) / window.length;
  const t = window.reduce((s, x) => s + x.tws, 0) / window.length;
  return {
    hdg: window.some(s => Math.abs(delta(s.heading, h)) > lim.hdg),
    spd: window.some(s => Math.abs(s.boatSpeed - b) > b * lim.spd),
    tws: window.some(s => Math.abs(s.tws - t) > lim.tws),
  };
}

function coverage(samples: readonly ReplayCaptureSample[], lim: Limits) {
  let covered = 0, count = 0;
  for (const group of groupsOf(samples)) {
    const sm = smooth(group);
    const windows: { startTime: number; endTime: number }[] = [];
    let start = 0;
    for (let end = 0; end < sm.length; end += 1) {
      while (start < end && sm[end].timestamp - sm[start + 1].timestamp + 1_000 >= STEADY_MIN_MS) start += 1;
      if (sm[end].timestamp - sm[start].timestamp + 1_000 < STEADY_MIN_MS) continue;
      const f = fails(sm.slice(start, end + 1), lim);
      if (!f.hdg && !f.spd && !f.tws) windows.push({ startTime: sm[start].timestamp, endTime: sm[end].timestamp + 1_000 });
    }
    const merged: { startTime: number; endTime: number }[] = [];
    for (const w of windows) {
      const p = merged.at(-1);
      if (!p || w.startTime > p.endTime) merged.push({ ...w });
      else p.endTime = Math.max(p.endTime, w.endTime);
    }
    covered += merged.reduce((s, w) => s + (w.endTime - w.startTime), 0);
    count += merged.length;
  }
  return { covered, count };
}

describe('steadiness probe', () => {
  it('says which predicate is binding, and what it costs downstream', () => {
    const legSamples = result.sailedLegs.map(l =>
      result.samples.filter(s => s.timestamp >= l.startTime && s.timestamp < l.endTime));
    const all = legSamples.flat();
    const legMs = result.sailedLegs.reduce((s, l) => s + (l.endTime - l.startTime), 0);

    // sanity: the re-implementation must reproduce the shipped result
    const shipped = legSamples.reduce((s, ls) =>
      s + findSteadyStretches(ls).reduce((a, st) => a + (st.endTime - st.startTime), 0), 0);
    const mine = legSamples.reduce((s, ls) => s + coverage(ls, DEFAULT).covered, 0);
    const out: string[] = [];
    out.push(`re-implementation check: shipped ${(shipped/1000).toFixed(0)} s vs probe ${(mine/1000).toFixed(0)} s`);

    // which predicate rejects a candidate window
    let total = 0; const only = { hdg: 0, spd: 0, tws: 0 }; const any = { hdg: 0, spd: 0, tws: 0 }; let pass = 0;
    for (const group of groupsOf(all)) {
      const sm = smooth(group);
      let start = 0;
      for (let end = 0; end < sm.length; end += 1) {
        while (start < end && sm[end].timestamp - sm[start + 1].timestamp + 1_000 >= STEADY_MIN_MS) start += 1;
        if (sm[end].timestamp - sm[start].timestamp + 1_000 < STEADY_MIN_MS) continue;
        total += 1;
        const f = fails(sm.slice(start, end + 1), DEFAULT);
        const n = Number(f.hdg) + Number(f.spd) + Number(f.tws);
        if (n === 0) { pass += 1; continue; }
        for (const k of ['hdg', 'spd', 'tws'] as const) {
          if (f[k]) { any[k] += 1; if (n === 1) only[k] += 1; }
        }
      }
    }
    const pc = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
    out.push('');
    out.push(`candidate 15 s windows inside legs: ${total}; pass ${pass} (${pc(pass)})`);
    out.push(`  rejected by heading  ±5°     : ${pc(any.hdg)}  (sole reason ${pc(only.hdg)})`);
    out.push(`  rejected by speed    ±5%     : ${pc(any.spd)}  (sole reason ${pc(only.spd)})`);
    out.push(`  rejected by TWS      ±1 kn   : ${pc(any.tws)}  (sole reason ${pc(only.tws)})`);

    // what loosening each one buys
    const variants: [string, Limits][] = [
      ['shipped        hdg 5°  spd 5%  tws 1.0', DEFAULT],
      ['heading  10°   hdg 10° spd 5%  tws 1.0', { hdg: 10, spd: 0.05, tws: 1 }],
      ['speed    10%   hdg 5°  spd 10% tws 1.0', { hdg: 5, spd: 0.10, tws: 1 }],
      ['TWS     1.5    hdg 5°  spd 5%  tws 1.5', { hdg: 5, spd: 0.05, tws: 1.5 }],
      ['speed 10 + hdg 10                      ', { hdg: 10, spd: 0.10, tws: 1 }],
      ['all loosened   hdg 10° spd 10% tws 2.0', { hdg: 10, spd: 0.10, tws: 2 }],
    ];
    out.push('');
    out.push('coverage of leg time, and the polar points it would yield with the');
    out.push('whole race attributed to one sail (MIN_BIN_SAMPLES = 30):');
    for (const [label, lim] of variants) {
      let covered = 0, count = 0;
      for (const ls of legSamples) { const c = coverage(ls, lim); covered += c.covered; count += c.count; }
      // points, using the session-wide mask the way capturePromotion does
      const sessionMask: any[] = [];
      for (const group of groupsOf(result.samples)) {
        const sm = smooth(group);
        let start = 0;
        for (let end = 0; end < sm.length; end += 1) {
          while (start < end && sm[end].timestamp - sm[start + 1].timestamp + 1_000 >= STEADY_MIN_MS) start += 1;
          if (sm[end].timestamp - sm[start].timestamp + 1_000 < STEADY_MIN_MS) continue;
          const f = fails(sm.slice(start, end + 1), lim);
          if (!f.hdg && !f.spd && !f.tws) {
            const w = { startTime: sm[start].timestamp, endTime: sm[end].timestamp + 1_000 };
            const p = sessionMask.at(-1);
            if (p && w.startTime <= p.endTime) p.endTime = Math.max(p.endTime, w.endTime);
            else sessionMask.push(w);
          }
        }
      }
      const points = proposePolarPoints(
        result.samples,
        result.sailedLegs.map(l => ({ legOrdinal: l.ordinal, startTime: l.startTime, endTime: l.endTime, sailId: 1 })),
        sessionMask,
      );
      out.push(`  ${label}  ${((covered / legMs) * 100).toFixed(1).padStart(5)}% of leg time, ` +
        `${String(count).padStart(3)} stretches, ${String(points.length).padStart(3)} polar points`);
    }
    console.log(out.join('\n'));
    expect(total).toBeGreaterThan(0);
  }, 300_000);
});
