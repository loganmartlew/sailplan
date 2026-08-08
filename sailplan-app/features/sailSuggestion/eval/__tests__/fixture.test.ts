import {
  acceptableLeaders,
  buildFixture,
  interpolateBaseSpeed,
  parsePolarCsv,
  strictExpectedWinner,
  type FixtureManifest,
} from '../fixture';

/**
 * Unit tests for the eval harness's ground-truth logic — these DO run in the
 * default jest suite (the fixtures themselves are only swept by the opt-in
 * `accuracy.eval.ts`). The D3 boundary rule especially is easy to get subtly
 * wrong, and every harness number depends on it.
 */

// Two-sail manifest: Slow owns 100–140°, Fast owns 140–180°, bands touching
// at 140°. Fast is faster wherever both are in band.
function makeManifest(overrides?: Partial<FixtureManifest>): FixtureManifest {
  return {
    name: 'test',
    description: 'test manifest',
    seed: 1,
    recipe: 'clean',
    boundaryToleranceDeg: 5,
    sweep: { twaMin: 100, twaMax: 180, twaStep: 5, twsValues: [10] },
    sails: [
      {
        name: 'Slow',
        symmetrical: false,
        twaBand: [100, 140],
        baseSpeeds: { 4: 3, 16: 8 },
      },
      {
        name: 'Fast',
        symmetrical: true,
        twaBand: [140, 180],
        baseSpeeds: { 4: 4, 16: 10 },
      },
    ],
    ...overrides,
  };
}

describe('interpolateBaseSpeed', () => {
  const curve = { 4: 2, 10: 8, 16: 10 };

  it('interpolates linearly between nodes', () => {
    expect(interpolateBaseSpeed(7, curve)).toBeCloseTo(5);
    expect(interpolateBaseSpeed(13, curve)).toBeCloseTo(9);
  });

  it('returns exact values at nodes', () => {
    expect(interpolateBaseSpeed(10, curve)).toBe(8);
  });

  it('clamps outside the curve ends', () => {
    expect(interpolateBaseSpeed(2, curve)).toBe(2);
    expect(interpolateBaseSpeed(30, curve)).toBe(10);
  });
});

describe('strictExpectedWinner', () => {
  const manifest = makeManifest();

  it('picks the only in-band sail', () => {
    expect(strictExpectedWinner(manifest, 120, 10)).toBe('Slow');
    expect(strictExpectedWinner(manifest, 160, 10)).toBe('Fast');
  });

  it('picks the fastest sail where bands overlap', () => {
    expect(strictExpectedWinner(manifest, 140, 10)).toBe('Fast');
  });

  it('returns null in a coverage gap', () => {
    expect(strictExpectedWinner(manifest, 90, 10)).toBeNull();
    expect(strictExpectedWinner(manifest, 185, 10)).toBeNull();
  });
});

describe('acceptableLeaders (D3 boundary rule)', () => {
  const manifest = makeManifest();

  it('is just the strict winner mid-band', () => {
    expect(acceptableLeaders(manifest, 120, 10)).toEqual(['Slow']);
    expect(acceptableLeaders(manifest, 160, 10)).toEqual(['Fast']);
  });

  it('accepts either neighbour within one grid step of a band edge', () => {
    // 135° is one 5° step below the 140° crossover: Slow leads strictly, but
    // Fast (winner at 140°) is also acceptable.
    expect(acceptableLeaders(manifest, 135, 10)).toEqual(['Slow', 'Fast']);
    // 145° is one step above: Fast leads strictly, Slow also acceptable.
    expect(acceptableLeaders(manifest, 145, 10)).toEqual(['Fast', 'Slow']);
  });

  it('does not widen two grid steps from the edge', () => {
    expect(acceptableLeaders(manifest, 130, 10)).toEqual(['Slow']);
    expect(acceptableLeaders(manifest, 150, 10)).toEqual(['Fast']);
  });

  it('is empty in a coverage gap, even near a band edge', () => {
    expect(acceptableLeaders(manifest, 95, 10)).toEqual([]);
  });

  it('ignores a neighbour that falls in a coverage gap', () => {
    // 100° is the low edge of Slow's band; 95° has no winner.
    expect(acceptableLeaders(manifest, 100, 10)).toEqual(['Slow']);
  });
});

describe('parsePolarCsv', () => {
  it('parses positional columns and skips the header and blank lines', () => {
    const csv = [
      'Timestamp,Sail,TWS,TWA,BoatSpeed,Notes',
      '2026-06-30T00:00:00.000Z,Slow,10.00,120,7.50,On Target',
      '',
      '2026-06-30T00:00:00.000Z,Fast,12.50,160,9.25,Surfing/Planing',
    ].join('\n');

    expect(parsePolarCsv(csv)).toEqual([
      { sailName: 'Slow', tws: 10, twa: 120, speed: 7.5 },
      { sailName: 'Fast', tws: 12.5, twa: 160, speed: 9.25 },
    ]);
  });
});

describe('buildFixture', () => {
  const csv = [
    'Timestamp,Sail,TWS,TWA,BoatSpeed,Notes',
    '2026-06-30T00:00:00.000Z,Slow,10.00,120,7.50,On Target',
    '2026-06-30T00:00:00.000Z,slow,12.00,130,7.80,On Target',
    '2026-06-30T00:00:00.000Z,Fast,10.00,160,9.00,On Target',
  ].join('\n');

  it('assigns ids in manifest order and matches CSV names case-insensitively', () => {
    const fixture = buildFixture(makeManifest(), csv);

    expect(fixture.sails.map(s => [s.id, s.name])).toEqual([
      [1, 'Slow'],
      [2, 'Fast'],
    ]);
    expect(fixture.polars.get(1)).toHaveLength(2);
    expect(fixture.polars.get(2)).toEqual([{ tws: 10, twa: 160, speed: 9 }]);
  });

  it('builds limit rows only for sails that declare them', () => {
    const manifest = makeManifest();
    manifest.sails[1].limits = [{ tws: 10, minTwa: 140, maxTwa: 180 }];

    const fixture = buildFixture(manifest, csv);

    expect(fixture.limits.has(1)).toBe(false);
    expect(fixture.limits.get(2)).toEqual([
      { id: 0, sailId: 2, tws: 10, minTwa: 140, maxTwa: 180 },
    ]);
  });

  it('throws on a CSV row for a sail the manifest does not know', () => {
    const badCsv =
      'Timestamp,Sail,TWS,TWA,BoatSpeed,Notes\n' +
      '2026-06-30T00:00:00.000Z,Ghost,10.00,120,7.50,On Target';
    expect(() => buildFixture(makeManifest(), badCsv)).toThrow(/Ghost/);
  });
});
