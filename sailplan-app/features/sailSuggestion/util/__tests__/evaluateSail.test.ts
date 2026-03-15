import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import { evaluateSail } from '../evaluateSail';
import type { SuggestionGuard } from '../../model/guard';

function makeSail(overrides: Partial<Sail> = {}): Sail {
  return {
    id: 1,
    name: 'Test Sail',
    color: '#ffffff',
    sailArea: null,
    symmetrical: false,
    masthead: false,
    boatProfileId: 1,
    ...overrides,
  };
}

function makeLimitRow(
  tws: number,
  minTwa: number | null,
  maxTwa: number | null,
): SailTwaLimit {
  return { id: 0, sailId: 1, tws, minTwa, maxTwa };
}

// Dense polar grid around TWA=90, TWS=12 → should produce high confidence in reaching zone
const densePolars: PolarPoint[] = [
  { tws: 10, twa: 80, speed: 5.5 },
  { tws: 10, twa: 90, speed: 6.0 },
  { tws: 10, twa: 100, speed: 5.8 },
  { tws: 12, twa: 80, speed: 6.2 },
  { tws: 12, twa: 90, speed: 6.8 },
  { tws: 12, twa: 100, speed: 6.5 },
  { tws: 14, twa: 80, speed: 6.8 },
  { tws: 14, twa: 90, speed: 7.2 },
  { tws: 14, twa: 100, speed: 7.0 },
];

// Sparse polars — only 1 far-off point → low confidence
const sparsePolars: PolarPoint[] = [{ tws: 20, twa: 130, speed: 4.0 }];

const noGuards: SuggestionGuard[] = [];

// ---------------------------------------------------------------------------
// evaluateSail — high confidence
// ---------------------------------------------------------------------------
describe('evaluateSail — high confidence', () => {
  it('produces high confidence tier with dense polar data', () => {
    const result = evaluateSail(makeSail(), 90, 12, densePolars, [], noGuards);

    expect(result.confidenceTier).toBe('high');
    expect(result.windZone).toBe('reaching');
    expect(result.predictedSpeed).toBeGreaterThan(0);
    expect(result.reasoning.polarUsed).toBe(true);
  });

  it('records negative limitScore when outside TWA limits', () => {
    const limits = [makeLimitRow(10, 100, 130), makeLimitRow(15, 110, 140)];
    // TWA=90 is outside the limit range (min ~100, max ~130 at TWS=12)
    const result = evaluateSail(
      makeSail(),
      90,
      12,
      densePolars,
      limits,
      noGuards,
    );

    expect(result.limitScore).not.toBeNull();
    expect(result.limitScore!).toBeLessThan(0);
    expect(result.limitsExceeded).toBe(true);
  });

  it('records positive limitScore when inside TWA limits', () => {
    const limits = [makeLimitRow(10, 60, 120), makeLimitRow(15, 65, 125)];
    const result = evaluateSail(
      makeSail(),
      90,
      12,
      densePolars,
      limits,
      noGuards,
    );

    expect(result.limitScore).not.toBeNull();
    expect(result.limitScore!).toBeGreaterThan(0);
    expect(result.limitsExceeded).toBe(false);
  });

  it('computes guard penalty', () => {
    const penaltyGuard: SuggestionGuard = {
      name: 'test',
      evaluate: () => ({ guardName: 'test', penalty: 0.3, reason: 'test' }),
    };
    const result = evaluateSail(
      makeSail(),
      90,
      12,
      densePolars,
      [],
      [penaltyGuard],
    );

    expect(result.guards).toHaveLength(1);
    expect(result.reasoning.guardPenaltyTotal).toBeCloseTo(0.3, 5);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — moderate confidence
// ---------------------------------------------------------------------------
describe('evaluateSail — moderate confidence', () => {
  // Few polars, not close to target → moderate confidence in reaching zone
  const moderatePolars: PolarPoint[] = [
    { tws: 8, twa: 75, speed: 5.0 },
    { tws: 16, twa: 105, speed: 6.5 },
  ];

  it('classifies moderate confidence correctly', () => {
    const result = evaluateSail(
      makeSail(),
      90,
      12,
      moderatePolars,
      [],
      noGuards,
    );

    // With 2 distant points, confidence should be moderate (~0.3-0.6) in reaching zone
    expect(result.confidenceTier).toBe('moderate');
    expect(result.predictedSpeed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — low confidence
// ---------------------------------------------------------------------------
describe('evaluateSail — low confidence', () => {
  it('classifies low confidence with sparse data', () => {
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, [], noGuards);

    expect(result.confidenceTier).toBe('low');
  });

  it('populates limitScore when limits are configured', () => {
    const limits = [makeLimitRow(10, 60, 120), makeLimitRow(15, 65, 125)];
    const result = evaluateSail(
      makeSail(),
      90,
      12,
      sparsePolars,
      limits,
      noGuards,
    );

    expect(result.hasLimits).toBe(true);
    expect(result.limitScore).not.toBeNull();
  });

  it('returns null limitScore when no limits configured', () => {
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, [], noGuards);

    expect(result.hasLimits).toBe(false);
    expect(result.limitScore).toBeNull();
  });

  it('still applies guard penalties', () => {
    const guard: SuggestionGuard = {
      name: 'test',
      evaluate: () => ({ guardName: 'test', penalty: 0.5, reason: 'test' }),
    };
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, [], [guard]);

    expect(result.guards).toHaveLength(1);
    expect(result.reasoning.guardPenaltyTotal).toBeCloseTo(0.5, 5);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — wind zone classification
// ---------------------------------------------------------------------------
describe('evaluateSail — wind zone classification', () => {
  it('TWA=45° → upwind', () => {
    const result = evaluateSail(makeSail(), 45, 12, densePolars, [], noGuards);
    expect(result.windZone).toBe('upwind');
  });

  it('TWA=60° → upwind', () => {
    const result = evaluateSail(makeSail(), 60, 12, densePolars, [], noGuards);
    expect(result.windZone).toBe('upwind');
  });

  it('TWA=80° → reaching (boundary)', () => {
    const result = evaluateSail(makeSail(), 80, 12, densePolars, [], noGuards);
    expect(result.windZone).toBe('reaching');
  });

  it('TWA=90° → reaching', () => {
    const result = evaluateSail(makeSail(), 90, 12, densePolars, [], noGuards);
    expect(result.windZone).toBe('reaching');
  });

  it('TWA=150° → reaching (boundary)', () => {
    const result = evaluateSail(makeSail(), 150, 12, densePolars, [], noGuards);
    expect(result.windZone).toBe('reaching');
  });

  it('TWA=151° → downwind', () => {
    const result = evaluateSail(makeSail(), 151, 12, densePolars, [], noGuards);
    expect(result.windZone).toBe('downwind');
  });
});
