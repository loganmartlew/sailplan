#!/usr/bin/env node
/**
 * The scoreboard. Reads a generated log plus its ground-truth manifest and
 * answers two questions in numbers rather than opinions:
 *
 *   1. TRUE-WIND ROUND TRIP — reduce `MWV,R` (apparent) + `VHW` (boat speed)
 *      back to true wind and compare against the `MWV,T` the plotter emitted.
 *      This is ticket `05` question 2. A sign error, a degree/radian slip, or
 *      an off-by-180 shows up here as tens of degrees, not as rounding.
 *
 *   2. DERIVATION BIAS — bin the samples the way the app's clustered polar
 *      grid does (1 kn TWS x 4 degrees TWA), take each candidate summary
 *      statistic over each bin, and compare against the speed the boat TRULY
 *      had there. This is ticket `07`: founding decision 7 says "high
 *      percentile, because polars describe best achievable speed"; research/12
 *      computed against this noise model that the 90th overstates by ~8.3 %.
 *      This measures it end to end instead of computing it, and it measures it
 *      with trim HELD over a dwell, which is the realistic case the closed-form
 *      arithmetic could not cover.
 *
 * This is a measuring instrument for the map, not app code. It reimplements
 * nothing the app will ship — it is the independent second opinion the app's
 * own pipeline gets checked against.
 *
 *   node verify.js logs/race.log
 */

const fs = require('fs');
const path = require('path');
const { parseLog } = require('./lib/replay');
const { checksum } = require('./lib/sentences');

const rad = d => (d * Math.PI) / 180;
const degOf = r => (r * 180) / Math.PI;
const signed180 = d => {
  let a = ((d % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
};

function fields(text) {
  const star = text.lastIndexOf('*');
  const body = star === -1 ? text.slice(1) : text.slice(1, star);
  return { parts: body.split(','), ok: star !== -1 && checksum(body) === text.slice(star + 1) };
}

/** One sample per second, assembled the way the app will have to assemble it. */
function toSamples(lines) {
  const bySec = new Map();
  let base = null;

  for (const line of lines) {
    if (line.atMs === null) continue;
    if (base === null) base = line.atMs;
    const sec = Math.floor((line.atMs - base) / 1000);
    const f = fields(line.text);
    if (!f.ok) continue;
    const s = bySec.get(sec) || { t: sec };

    if (line.formatter === 'MWV') {
      const angle = Number(f.parts[1]);
      const speed = Number(f.parts[3]);
      if (f.parts[5] !== 'A' || !isFinite(angle) || !isFinite(speed)) continue;
      if (f.parts[2] === 'T') {
        s.twaSigned = signed180(angle);
        s.tws = speed;
      } else if (f.parts[2] === 'R') {
        s.awaSigned = signed180(angle);
        s.aws = speed;
      }
    } else if (line.formatter === 'VHW') {
      const stw = Number(f.parts[5]);
      if (isFinite(stw)) s.stw = stw;
    }

    bySec.set(sec, s);
  }

  // Only complete samples count. An incomplete one is exactly what ticket
  // `05`'s staleness question is about, so we report how many we dropped.
  const all = [...bySec.values()];
  const complete = all.filter(
    s => s.twaSigned !== undefined && s.awaSigned !== undefined && s.stw !== undefined,
  );
  return { complete, dropped: all.length - complete.length };
}

/** Apparent + boat speed -> true. The maths the app must get right. */
function deriveTrue(awaSigned, aws, stw) {
  const x = aws * Math.sin(rad(awaSigned));
  const y = aws * Math.cos(rad(awaSigned)) - stw;
  return { twaSigned: degOf(Math.atan2(x, y)), tws: Math.hypot(x, y) };
}

const percentile = (sorted, p) => {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

function main() {
  const logPath = process.argv[2] || path.join(__dirname, 'logs/race.log');
  const manifestPath = logPath.replace(/\.log$/, '') + '.manifest.json';
  if (!fs.existsSync(logPath)) {
    console.error(`verify: no log at ${logPath} — run \`node nmea-sim.js generate\` first`);
    process.exit(1);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`verify: no manifest at ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { complete, dropped } = toSamples(parseLog(logPath));
  const truthByT = new Map(manifest.truth.map(r => [r.t, r]));

  console.log(`\n  ${path.basename(logPath)} — ${manifest.durationSec}s, ${complete.length} complete samples (${dropped} incomplete)\n`);

  // --- 1. True-wind round trip ---
  let angleErr = [];
  let speedErr = [];
  for (const s of complete) {
    const d = deriveTrue(s.awaSigned, s.aws, s.stw);
    angleErr.push(Math.abs(signed180(d.twaSigned - s.twaSigned)));
    speedErr.push(Math.abs(d.tws - s.tws));
  }
  console.log('  TRUE-WIND ROUND TRIP  (MWV,R + VHW  ->  MWV,T)');
  console.log(`    angle  mean ${mean(angleErr).toFixed(3)} deg   max ${Math.max(...angleErr).toFixed(3)} deg`);
  console.log(`    speed  mean ${mean(speedErr).toFixed(3)} kn    max ${Math.max(...speedErr).toFixed(3)} kn`);
  console.log('    (both should be ~0: the stream is self-consistent by construction.');
  console.log('     Non-zero here means the reduction is wrong, not the data.)\n');

  // --- 2. Derivation bias ---
  // Bin as the app does, then ask each candidate statistic how far it lands
  // from the truth. Steady-state samples only — a tack is not a polar point.
  const bins = new Map();
  for (const s of complete) {
    const truth = truthByT.get(s.t);
    if (!truth || truth.manoeuvring) continue;
    const key = `${truth.sail}|${Math.round(s.tws)}|${Math.round(Math.abs(s.twaSigned) / 4) * 4}`;
    const b = bins.get(key) || { speeds: [], truth: [] };
    b.speeds.push(s.stw);
    b.truth.push(truth.trueSpeed);
    bins.set(key, b);
  }

  const MIN_SAMPLES = 5; // a bin with three points cannot support a p90
  const usable = [...bins.values()].filter(b => b.speeds.length >= MIN_SAMPLES);

  const stats = {
    mean: v => mean(v),
    p50: v => percentile(v, 0.5),
    p75: v => percentile(v, 0.75),
    p90: v => percentile(v, 0.9),
    max: v => v[v.length - 1],
  };

  console.log(`  DERIVATION BIAS  (${usable.length} bins with >= ${MIN_SAMPLES} samples, steady state only)`);
  console.log('    statistic     bias      abs error    over-stated bins');
  for (const [name, fn] of Object.entries(stats)) {
    const biases = [];
    let over = 0;
    for (const b of usable) {
      const sorted = [...b.speeds].sort((x, y) => x - y);
      const truth = mean(b.truth);
      const bias = (fn(sorted) - truth) / truth;
      biases.push(bias);
      if (bias > 0) over++;
    }
    const pct = n => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
    console.log(
      `    ${name.padEnd(10)} ${pct(mean(biases)).padStart(8)}   ` +
        `${(mean(biases.map(Math.abs)) * 100).toFixed(2)}%`.padStart(10) +
        `   ${over}/${usable.length}`.padStart(12),
    );
  }
  console.log('\n    Bias is (statistic - true speed) / true speed, averaged over bins.');
  console.log('    Founding decision 7 picks a high percentile. Whatever this table');
  console.log("    says is ticket 07's evidence — it is measured, not argued.\n");
}

main();
