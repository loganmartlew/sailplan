/**
 * The boat's *true* polar — the single source of ground truth shared by
 * everything that fabricates data for this workspace.
 *
 * Two consumers, deliberately kept honest against each other:
 *   - `generate-polars.js` samples it into CSV fixtures for the
 *     sail-suggestion accuracy harness.
 *   - `../nmea-sim/` sails it, turning it into an NMEA stream so the ingestion
 *     pipeline can be asked "did you recover the polar you were given?".
 *
 * If these two ever disagree about what the boat can do, the round-trip test
 * is measuring the disagreement instead of the pipeline. Hence one file.
 */

// --- Seeded PRNG (mulberry32) ----------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Fleet ground truth ------------------------------------------------------

// Samples exist only inside `twaBand`; `baseSpeeds` is the true speed curve
// (kn at each TWS node, linearly interpolated, clamped at the ends). The
// expected winner at any condition is the fastest sail whose band contains
// the TWA — this is what the harness scores against.
const DOWNWIND_FLEET = [
  {
    name: 'A6',
    symmetrical: false,
    twaBand: [95, 120],
    baseSpeeds: { 4: 2.8, 10: 8.5, 16: 10.5, 26: 13.8 },
  },
  {
    name: 'A5',
    symmetrical: false,
    twaBand: [110, 130],
    baseSpeeds: { 4: 3.1, 10: 8.4, 16: 11.7, 26: 15.4 },
  },
  {
    name: 'A3',
    symmetrical: false,
    twaBand: [125, 140],
    baseSpeeds: { 4: 3.2, 10: 8.2, 16: 13.4, 26: 19.8 },
  },
  {
    name: 'A2',
    symmetrical: false,
    twaBand: [140, 165],
    baseSpeeds: { 4: 2.8, 10: 7.5, 16: 11.9, 26: 21.0 },
  },
  {
    name: 'S1.5',
    symmetrical: true,
    twaBand: [150, 170],
    baseSpeeds: { 4: 2.6, 10: 7.0, 16: 11.0, 26: 18.3 },
  },
  {
    name: 'S1',
    symmetrical: true,
    twaBand: [165, 180],
    baseSpeeds: { 4: 2.2, 10: 6.3, 16: 9.4, 26: 14.8 },
  },
];

// One upwind sail so the harness exercises the upwind wind zone — and so the
// simulator's beat legs have something legitimate to fly.
const JIB = {
  name: 'J1',
  symmetrical: false,
  twaBand: [35, 60],
  baseSpeeds: { 4: 3.4, 10: 6.1, 16: 7.3, 26: 7.9 },
};

// --- Speed lookup ------------------------------------------------------------

// Linear interpolation of the base speed curve, clamped at the end nodes.
function interpolateBaseSpeed(tws, baseSpeeds) {
  const keys = Object.keys(baseSpeeds)
    .map(Number)
    .sort((a, b) => a - b);
  if (tws <= keys[0]) return baseSpeeds[keys[0]];
  if (tws >= keys[keys.length - 1]) return baseSpeeds[keys[keys.length - 1]];

  for (let i = 0; i < keys.length - 1; i++) {
    const x0 = keys[i];
    const x1 = keys[i + 1];
    if (tws >= x0 && tws <= x1) {
      const y0 = baseSpeeds[x0];
      const y1 = baseSpeeds[x1];
      return y0 + ((tws - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
}

module.exports = {
  mulberry32,
  DOWNWIND_FLEET,
  JIB,
  interpolateBaseSpeed,
};
