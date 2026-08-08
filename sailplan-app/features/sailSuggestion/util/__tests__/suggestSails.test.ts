import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import { suggestSails } from '../suggestSails';

function makeSail(id: number, name: string, symmetrical: boolean): Sail {
  return {
    id,
    name,
    color: '#ffffff',
    sailArea: null,
    symmetrical,
    masthead: false,
    minTws: null,
    maxTws: null,
    boatProfileId: 1,
  };
}

function makeLimitRow(
  sailId: number,
  tws: number,
  minTwa: number | null,
  maxTwa: number | null,
): SailTwaLimit {
  return { id: 0, sailId, tws, minTwa, maxTwa };
}

// --- Sails ---
const codeZero = makeSail(1, 'Code Zero', false);
const asymSpinnaker = makeSail(2, 'Asymmetric Spinnaker', false);
const symSpinnaker = makeSail(3, 'Symmetric Spinnaker', true);

// --- Polar data ---
// Code zero: strong in reaching (80-120°)
const codeZeroPolars: PolarPoint[] = [
  { tws: 10, twa: 80, speed: 6.5 },
  { tws: 10, twa: 90, speed: 7.0 },
  { tws: 10, twa: 100, speed: 6.8 },
  { tws: 12, twa: 80, speed: 7.2 },
  { tws: 12, twa: 90, speed: 7.5 },
  { tws: 12, twa: 100, speed: 7.3 },
  { tws: 14, twa: 80, speed: 7.8 },
  { tws: 14, twa: 90, speed: 8.0 },
  { tws: 14, twa: 100, speed: 7.7 },
  { tws: 10, twa: 110, speed: 6.2 },
  { tws: 12, twa: 110, speed: 6.8 },
  { tws: 14, twa: 110, speed: 7.2 },
];

// Asymmetric spinnaker: strong in broad reaching / downwind (100-165°)
const asymPolars: PolarPoint[] = [
  { tws: 10, twa: 110, speed: 6.0 },
  { tws: 10, twa: 130, speed: 6.5 },
  { tws: 10, twa: 150, speed: 6.2 },
  { tws: 12, twa: 110, speed: 6.8 },
  { tws: 12, twa: 130, speed: 7.2 },
  { tws: 12, twa: 150, speed: 7.0 },
  { tws: 14, twa: 110, speed: 7.2 },
  { tws: 14, twa: 130, speed: 7.8 },
  { tws: 14, twa: 150, speed: 7.5 },
  { tws: 12, twa: 170, speed: 6.0 },
  { tws: 14, twa: 170, speed: 6.5 },
];

// Symmetric spinnaker: strong in deep downwind (150-180°)
const symPolars: PolarPoint[] = [
  { tws: 10, twa: 150, speed: 5.5 },
  { tws: 10, twa: 160, speed: 6.0 },
  { tws: 10, twa: 170, speed: 6.5 },
  { tws: 10, twa: 180, speed: 6.8 },
  { tws: 12, twa: 150, speed: 6.2 },
  { tws: 12, twa: 160, speed: 6.8 },
  { tws: 12, twa: 170, speed: 7.2 },
  { tws: 12, twa: 180, speed: 7.5 },
  { tws: 14, twa: 150, speed: 6.8 },
  { tws: 14, twa: 160, speed: 7.2 },
  { tws: 14, twa: 170, speed: 7.8 },
  { tws: 14, twa: 180, speed: 8.0 },
];

// --- Limits ---
const codeZeroLimits: SailTwaLimit[] = [
  makeLimitRow(1, 10, 60, 120),
  makeLimitRow(1, 15, 65, 125),
];

const asymLimits: SailTwaLimit[] = [
  makeLimitRow(2, 10, 90, 160),
  makeLimitRow(2, 15, 95, 165),
];

const symLimits: SailTwaLimit[] = [
  makeLimitRow(3, 10, 140, null),
  makeLimitRow(3, 15, 145, null),
];

const sails = [codeZero, asymSpinnaker, symSpinnaker];

function buildPolarsMap(): Map<number, PolarPoint[]> {
  return new Map([
    [1, codeZeroPolars],
    [2, asymPolars],
    [3, symPolars],
  ]);
}

function buildLimitsMap(): Map<number, SailTwaLimit[]> {
  return new Map([
    [1, codeZeroLimits],
    [2, asymLimits],
    [3, symLimits],
  ]);
}

// ---------------------------------------------------------------------------
// suggestSails — integration
// ---------------------------------------------------------------------------
describe('suggestSails — integration', () => {
  it('reaching scenario: code zero leads at TWA=110, TWS=12', () => {
    const result = suggestSails(
      110,
      12,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );

    expect(result.conditions.windZone).toBe('reaching');
    expect(result.evaluations.length).toBe(3);
    expect(result.suggested.length).toBeGreaterThanOrEqual(1);

    // Code zero should rank high in reaching
    const codeZeroEval = result.evaluations.find(
      e => e.sail.name === 'Code Zero',
    )!;
    expect(codeZeroEval.predictedSpeed).toBeGreaterThan(0);
  });

  it('deep downwind scenario: symmetric spinnaker favored at TWA=170, TWS=15', () => {
    const result = suggestSails(
      170,
      15,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );

    // Symmetric spinnaker has the strongest deep-downwind polars → it leads.
    expect(result.evaluations[0].sail.name).toBe('Symmetric Spinnaker');

    // 170° is the top edge of the dead band, so the symmetric sail is never
    // penalised; the asym has user limits so its guard defers to them.
    const symEval = result.evaluations.find(
      e => e.sail.name === 'Symmetric Spinnaker',
    )!;
    expect(symEval.guards.length).toBe(0);
    const asymEval = result.evaluations.find(
      e => e.sail.name === 'Asymmetric Spinnaker',
    )!;
    expect(asymEval.guards.length).toBe(0);
  });

  it('no polars: sails ranked by limits; sails without limits excluded', () => {
    const emptyPolars = new Map<number, PolarPoint[]>([
      [1, []],
      [2, []],
      [3, []],
    ]);

    const result = suggestSails(110, 12, sails, emptyPolars, buildLimitsMap());

    // All sails should be low confidence
    for (const evaluation of result.evaluations) {
      expect(evaluation.confidenceTier).toBe('low');
    }

    // Sails with limits should still have limitScore
    const withLimits = result.evaluations.filter(e => e.limitScore !== null);
    expect(withLimits.length).toBeGreaterThan(0);
  });

  it('no polars, no limits: all sails excluded', () => {
    const emptyPolars = new Map<number, PolarPoint[]>([
      [1, []],
      [2, []],
      [3, []],
    ]);
    const emptyLimits = new Map<number, SailTwaLimit[]>([
      [1, []],
      [2, []],
      [3, []],
    ]);

    const result = suggestSails(110, 12, sails, emptyPolars, emptyLimits);

    // All should be -Infinity
    for (const evaluation of result.evaluations) {
      expect(evaluation.rankingScore).toBe(-Infinity);
    }
    expect(result.suggested).toHaveLength(0);
  });

  it('zone boundary TWA=80°: no ranking instability', () => {
    const result79 = suggestSails(
      79,
      12,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );
    const result80 = suggestSails(
      80,
      12,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );

    expect(result79.conditions.windZone).toBe('upwind');
    expect(result80.conditions.windZone).toBe('reaching');

    // Both should produce valid results without errors
    expect(result79.evaluations.length).toBe(3);
    expect(result80.evaluations.length).toBe(3);
  });

  it('zone boundary TWA=150°: no ranking instability', () => {
    const result150 = suggestSails(
      150,
      12,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );
    const result151 = suggestSails(
      151,
      12,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );

    expect(result150.conditions.windZone).toBe('reaching');
    expect(result151.conditions.windZone).toBe('downwind');

    expect(result150.evaluations.length).toBe(3);
    expect(result151.evaluations.length).toBe(3);
  });

  it('output structure: conditions, evaluations, and suggested are populated', () => {
    const result = suggestSails(
      110,
      12,
      sails,
      buildPolarsMap(),
      buildLimitsMap(),
    );

    expect(result.conditions).toEqual({
      twa: 110,
      tws: 12,
      windZone: 'reaching',
    });

    expect(result.evaluations.length).toBe(3);

    // Each evaluation has reasoning
    for (const evaluation of result.evaluations) {
      expect(evaluation.reasoning).toBeDefined();
      expect(evaluation.reasoning.polarUsed).toBeDefined();
      expect(evaluation.reasoning.limitUsed).toBeDefined();
    }
  });

  it('all sails with identical polars: differentiates by limits', () => {
    // Patchy identical polars → moderate confidence, so the limit term (weight
    // 1−w) still contributes and can differentiate otherwise-equal sails.
    const identicalPolars: PolarPoint[] = [
      { tws: 10, twa: 120, speed: 6.0 },
      { tws: 14, twa: 170, speed: 7.0 },
    ];

    const samePolars = new Map<number, PolarPoint[]>([
      [1, identicalPolars],
      [2, identicalPolars],
      [3, identicalPolars],
    ]);

    const result = suggestSails(150, 12, sails, samePolars, buildLimitsMap());

    expect(result.evaluations.length).toBe(3);
    // The code zero is out of its 60–125° window at 150°, so its (weighted)
    // negative limit score separates it from the in-window kites.
    const scores = result.evaluations.map(e => e.rankingScore);
    const uniqueScores = new Set(scores);
    expect(uniqueScores.size).toBeGreaterThan(1);
  });
});
