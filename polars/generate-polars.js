/**
 * Polar fixture generator for the sail-suggestion evaluation harness
 * (Package E — see sailplan-app/docs/sail-suggestion/package-e-eval-harness.md).
 *
 * Emits named fixture variants into ./fixtures/, each as a CSV (same
 * `Timestamp,Sail,TWS,TWA,BoatSpeed,Notes` format the app's polar import
 * reads) plus a `*.manifest.json` holding the ground truth the CSV was
 * generated from: each sail's intended TWA band, base speed curve, symmetry,
 * optional explicit TWA limits, and the sweep the harness should run.
 *
 * All randomness comes from a seeded PRNG, so regenerating a variant is
 * byte-for-byte reproducible and the harness baselines stay stable.
 * `noisy-log` and `with-limits` share a seed and recipe — their CSVs are
 * identical, so any score difference between them is attributable to the
 * explicit limits alone.
 *
 * Usage:
 *   node generate-polars.js              # writes every variant
 *   node generate-polars.js noisy-log    # writes selected variant(s)
 *
 * The legacy `polars_random.csv` (unseeded ancestor of `noisy-log`, used for
 * the round-2 accuracy review) is kept as-is and no longer regenerated.
 */

const fs = require('fs');
const path = require('path');

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

// One upwind sail so the harness exercises the upwind wind zone.
const JIB = {
  name: 'J1',
  symmetrical: false,
  twaBand: [35, 60],
  baseSpeeds: { 4: 3.4, 10: 6.1, 16: 7.3, 26: 7.9 },
};

// Explicit TWA limits for a subset of the fleet (the `with-limits` variant):
// min/max equal to the true band, at the app's standard limit TWS values.
// Covers an asym at each band extreme plus a symmetric kite, so the limit
// interpolation, trapezoid curve, and `skipWhenLimitsDefined` all wake up.
const LIMIT_TWS_VALUES = [5, 10, 15, 20, 25];
const LIMITED_SAILS = ['A6', 'A2', 'S1'];

function limitsFor(sail) {
  if (!LIMITED_SAILS.includes(sail.name)) return undefined;
  return LIMIT_TWS_VALUES.map(tws => ({
    tws,
    minTwa: sail.twaBand[0],
    maxTwa: sail.twaBand[1],
  }));
}

// --- Sampling ----------------------------------------------------------------

// Fixed epoch so timestamps are deterministic (the app ignores them anyway).
const EPOCH = Date.UTC(2026, 5, 30);

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

/**
 * Noisy-log recipe (the round-2 review dataset's shape): 3 samples per grid
 * node with ±0.3 kn TWS noise, −2..+2° TWA noise, and a 0.82–1.15× speed
 * factor simulating trim/surfing. Mimics logged instrument data.
 */
function sampleNoisy(fleet, rand) {
  const rows = [];
  for (const sail of fleet) {
    for (let tws = 4; tws <= 26; tws += 2) {
      for (let twa = sail.twaBand[0]; twa <= sail.twaBand[1]; twa += 5) {
        const baseV = interpolateBaseSpeed(tws, sail.baseSpeeds);

        for (let i = 0; i < 3; i++) {
          const timestamp = new Date(EPOCH - rand() * 100000000).toISOString();
          const twsNoise = (tws + (rand() * 0.6 - 0.3)).toFixed(2);
          const twaNoise = twa + Math.floor(rand() * 5 - 2);

          // 0.85+ = surfing flyer, <0.2 = poor trim, else on target.
          const roll = rand();
          let speedFactor;
          let note;
          if (roll > 0.85) {
            speedFactor = 1.05 + rand() * 0.1;
            note = 'Surfing/Planing';
          } else if (roll < 0.2) {
            speedFactor = 0.82 + rand() * 0.1;
            note = 'Poor Trim';
          } else {
            speedFactor = 0.97 + rand() * 0.06;
            note = 'On Target';
          }

          rows.push(
            `${timestamp},${sail.name},${twsNoise},${twaNoise},${(baseV * speedFactor).toFixed(2)},${note}`,
          );
        }
      }
    }
  }
  return rows;
}

/**
 * Clean-grid recipe: exactly one noise-free sample per grid node — the shape
 * of a hand-entered polar table. This is the variant the bilinear path should
 * serve ~100 % of.
 */
function sampleClean(fleet) {
  const rows = [];
  const timestamp = new Date(EPOCH).toISOString();
  for (const sail of fleet) {
    for (let tws = 4; tws <= 26; tws += 2) {
      for (let twa = sail.twaBand[0]; twa <= sail.twaBand[1]; twa += 5) {
        const baseV = interpolateBaseSpeed(tws, sail.baseSpeeds);
        rows.push(
          `${timestamp},${sail.name},${tws.toFixed(2)},${twa},${baseV.toFixed(2)},On Target`,
        );
      }
    }
  }
  return rows;
}

// --- Variants ----------------------------------------------------------------

const DOWNWIND_SWEEP = {
  twaMin: 95,
  twaMax: 180,
  twaStep: 5,
  twsValues: [6, 10, 14, 18, 22],
};

const VARIANTS = {
  'noisy-log': {
    seed: 42,
    fleet: DOWNWIND_FLEET,
    recipe: 'noisy',
    withLimits: false,
    sweep: DOWNWIND_SWEEP,
    description:
      'Noisy logged-instrument-style scatter (3 samples/node, TWS/TWA/speed noise). ' +
      'The round-2 review dataset recipe, seeded. No explicit TWA limits.',
  },
  'clean-grid': {
    seed: 42,
    fleet: DOWNWIND_FLEET,
    recipe: 'clean',
    withLimits: false,
    sweep: DOWNWIND_SWEEP,
    description:
      'Noise-free hand-entered-table-style grid (1 sample/node). ' +
      'Exercises the bilinear interpolation path.',
  },
  'with-limits': {
    seed: 42,
    fleet: DOWNWIND_FLEET,
    recipe: 'noisy',
    withLimits: true,
    sweep: DOWNWIND_SWEEP,
    description:
      'Identical CSV to noisy-log (same seed/recipe); the manifest adds explicit ' +
      'TWA limits for A6, A2 and S1, waking the limit-scoring path and ' +
      'skipWhenLimitsDefined.',
  },
  upwind: {
    seed: 7,
    fleet: [...DOWNWIND_FLEET, JIB],
    recipe: 'noisy',
    withLimits: false,
    sweep: { ...DOWNWIND_SWEEP, twaMin: 35 },
    description:
      'Noisy fleet plus a J1 jib (35–60°) so the upwind wind zone is exercised. ' +
      'Sweep TWAs in the 60–95° coverage gap have no expected winner and are skipped.',
  },
};

// D3 boundary tolerance: within one sweep grid step of a band edge, either
// neighbouring sail counts as a correct leader.
const BOUNDARY_TOLERANCE_DEG = 5;

// --- Emit --------------------------------------------------------------------

function generateVariant(name) {
  const variant = VARIANTS[name];
  const rand = mulberry32(variant.seed);

  const rows =
    variant.recipe === 'noisy'
      ? sampleNoisy(variant.fleet, rand)
      : sampleClean(variant.fleet);
  const csv = ['Timestamp,Sail,TWS,TWA,BoatSpeed,Notes', ...rows].join('\n');

  const manifest = {
    name,
    description: variant.description,
    seed: variant.seed,
    recipe: variant.recipe,
    boundaryToleranceDeg: BOUNDARY_TOLERANCE_DEG,
    sweep: variant.sweep,
    sails: variant.fleet.map(sail => ({
      name: sail.name,
      symmetrical: sail.symmetrical,
      twaBand: sail.twaBand,
      baseSpeeds: sail.baseSpeeds,
      ...(variant.withLimits && limitsFor(sail)
        ? { limits: limitsFor(sail) }
        : {}),
    })),
  };

  const dir = path.join(__dirname, 'fixtures');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.csv`), csv);
  fs.writeFileSync(
    path.join(dir, `${name}.manifest.json`),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(`fixtures/${name}: ${rows.length} rows`);
}

const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : Object.keys(VARIANTS);
for (const name of names) {
  if (!VARIANTS[name]) {
    console.error(
      `Unknown variant "${name}". Available: ${Object.keys(VARIANTS).join(', ')}`,
    );
    process.exit(1);
  }
  generateVariant(name);
}
