import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';

/**
 * Fixture model for the accuracy-evaluation harness (Package E).
 *
 * A fixture is a CSV of polar samples plus a manifest holding the ground
 * truth the CSV was generated from — see `polars/generate-polars.js`, which
 * emits both. Everything in this file is pure (no filesystem access): the
 * opt-in eval suite does the file IO and feeds strings/objects in here, so
 * these helpers stay unit-testable in the default jest run.
 *
 * This module is harness-only. It must never be imported by app code (it is
 * deliberately not exported from the feature barrel).
 */

export interface ManifestLimitRow {
  tws: number;
  minTwa: number | null;
  maxTwa: number | null;
}

export interface ManifestSail {
  name: string;
  symmetrical: boolean;
  /** The TWA band samples were generated inside — the sail's true envelope. */
  twaBand: [number, number];
  /** True speed curve: kn at each TWS node, linearly interpolated, clamped. */
  baseSpeeds: Record<string, number>;
  /** Explicit TWA limits, present only in the `with-limits` variant. */
  limits?: ManifestLimitRow[];
}

export interface SweepSpec {
  twaMin: number;
  twaMax: number;
  twaStep: number;
  twsValues: number[];
}

export interface FixtureManifest {
  name: string;
  description: string;
  seed: number;
  recipe: 'noisy' | 'clean';
  /**
   * D3 boundary tolerance (degrees): within this distance of a band edge,
   * either neighbouring sail counts as a correct leader.
   */
  boundaryToleranceDeg: number;
  sweep: SweepSpec;
  sails: ManifestSail[];
}

/** A fixture materialised into the shapes `suggestSails` consumes. */
export interface EvalFixture {
  manifest: FixtureManifest;
  sails: Sail[];
  polars: Map<number, PolarPoint[]>;
  limits: Map<number, SailTwaLimit[]>;
}

// --- CSV parsing -------------------------------------------------------------

export interface PolarCsvRow {
  sailName: string;
  tws: number;
  twa: number;
  speed: number;
}

/**
 * Parses the generator's CSV (`Timestamp,Sail,TWS,TWA,BoatSpeed,Notes`) the
 * same way the app's import does: positional columns, header skipped.
 * Malformed rows are dropped.
 */
export function parsePolarCsv(csv: string): PolarCsvRow[] {
  const rows: PolarCsvRow[] = [];
  for (const line of csv.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const [, sailName, tws, twa, speed] = line.split(',');
    const row = {
      sailName,
      tws: parseFloat(tws),
      twa: parseFloat(twa),
      speed: parseFloat(speed),
    };
    if (!row.sailName || isNaN(row.tws) || isNaN(row.twa) || isNaN(row.speed))
      continue;
    rows.push(row);
  }
  return rows;
}

// --- Fixture assembly ----------------------------------------------------------

/**
 * Materialises a manifest + CSV into the fleet, polar map, and limit map that
 * `suggestSails` takes. Sail ids are assigned 1..n in manifest order; CSV rows
 * are matched to sails by name (case-insensitive, like the app's import).
 */
export function buildFixture(
  manifest: FixtureManifest,
  csv: string,
): EvalFixture {
  const sails: Sail[] = manifest.sails.map((s, index) => ({
    id: index + 1,
    name: s.name,
    color: '#ffffff',
    sailArea: null,
    symmetrical: s.symmetrical,
    masthead: false,
    minTws: null,
    maxTws: null,
    boatProfileId: 1,
  }));
  const idByName = new Map(sails.map(s => [s.name.toLowerCase(), s.id]));

  const polars = new Map<number, PolarPoint[]>(sails.map(s => [s.id, []]));
  for (const row of parsePolarCsv(csv)) {
    const id = idByName.get(row.sailName.toLowerCase());
    if (id === undefined) {
      throw new Error(`CSV row references unknown sail "${row.sailName}"`);
    }
    polars.get(id)!.push({ tws: row.tws, twa: row.twa, speed: row.speed });
  }

  const limits = new Map<number, SailTwaLimit[]>();
  manifest.sails.forEach((s, index) => {
    if (!s.limits) return;
    const sailId = index + 1;
    limits.set(
      sailId,
      s.limits.map(l => ({ id: 0, sailId, ...l })),
    );
  });

  return { manifest, sails, polars, limits };
}

// --- Ground truth --------------------------------------------------------------

/** Linear interpolation of a base speed curve, clamped at the end nodes. */
export function interpolateBaseSpeed(
  tws: number,
  baseSpeeds: Record<string, number>,
): number {
  const nodes = Object.entries(baseSpeeds)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);
  if (tws <= nodes[0][0]) return nodes[0][1];
  const last = nodes[nodes.length - 1];
  if (tws >= last[0]) return last[1];

  for (let i = 0; i < nodes.length - 1; i++) {
    const [x0, y0] = nodes[i];
    const [x1, y1] = nodes[i + 1];
    if (tws >= x0 && tws <= x1) {
      return y0 + ((tws - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  /* istanbul ignore next -- unreachable: nodes bracket tws */
  return last[1];
}

/**
 * The strictly expected winner at a condition: the fastest sail whose band
 * contains the TWA, by true base speed at that TWS. `null` when no band
 * covers the TWA (a coverage gap — the sweep skips such conditions).
 */
export function strictExpectedWinner(
  manifest: FixtureManifest,
  twa: number,
  tws: number,
): string | null {
  let winner: string | null = null;
  let best = -Infinity;
  for (const sail of manifest.sails) {
    if (twa < sail.twaBand[0] || twa > sail.twaBand[1]) continue;
    const speed = interpolateBaseSpeed(tws, sail.baseSpeeds);
    if (speed > best) {
      best = speed;
      winner = sail.name;
    }
  }
  return winner;
}

/**
 * The D3-adjusted set of acceptable leaders: the strict winner, plus — for
 * every band edge within one boundary tolerance of the TWA — the strict
 * winners just either side of that edge. Because base speeds don't vary with
 * TWA, the winner only changes at band edges, so this widens the acceptable
 * set exactly at crossover angles and nowhere else, symmetrically on both
 * sides of the edge (sampling *at* an edge would resolve the tie to the
 * faster sail and silently drop the neighbour whose band ends there). Empty
 * when the condition sits in a coverage gap.
 */
export function acceptableLeaders(
  manifest: FixtureManifest,
  twa: number,
  tws: number,
): string[] {
  const strict = strictExpectedWinner(manifest, twa, tws);
  if (strict === null) return [];

  const EPS = 1e-3;
  const acceptable = [strict];
  const add = (name: string | null) => {
    if (name !== null && !acceptable.includes(name)) acceptable.push(name);
  };
  for (const sail of manifest.sails) {
    for (const edge of sail.twaBand) {
      if (Math.abs(twa - edge) > manifest.boundaryToleranceDeg) continue;
      add(strictExpectedWinner(manifest, edge - EPS, tws));
      add(strictExpectedWinner(manifest, edge + EPS, tws));
    }
  }
  return acceptable;
}
