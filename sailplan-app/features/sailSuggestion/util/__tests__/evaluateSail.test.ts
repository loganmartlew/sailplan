import type { Sail } from '~/features/sail';
import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import type { SuggestionGuard } from '../../model/guard';
import { DEFAULT_SUGGESTION_CONFIG } from '../../model/suggestionConfig';
import { evaluateSail } from '../evaluateSail';

const cfg = DEFAULT_SUGGESTION_CONFIG;

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

// Dense polar grid around TWA=90, TWS=12 → should produce high confidence.
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
    const result = evaluateSail(makeSail(), 90, 12, densePolars, [], noGuards, cfg);

    expect(result.confidenceTier).toBe('high');
    expect(result.windZone).toBe('reaching');
    expect(result.predictedSpeed).toBeGreaterThan(0);
    expect(result.reasoning.polarUsed).toBe(true);
  });

  it('records negative limitScore when outside TWA limits', () => {
    const limits = [makeLimitRow(10, 100, 130), makeLimitRow(15, 110, 140)];
    // TWA=90 is outside the limit range (min ~104, max ~134 at TWS=12)
    const result = evaluateSail(makeSail(), 90, 12, densePolars, limits, noGuards, cfg);

    expect(result.limitScore).not.toBeNull();
    expect(result.limitScore!).toBeLessThan(0);
    expect(result.limitsExceeded).toBe(true);
  });

  it('records positive limitScore when inside TWA limits', () => {
    const limits = [makeLimitRow(10, 60, 120), makeLimitRow(15, 65, 125)];
    const result = evaluateSail(makeSail(), 90, 12, densePolars, limits, noGuards, cfg);

    expect(result.limitScore).not.toBeNull();
    expect(result.limitScore!).toBeGreaterThan(0);
    expect(result.limitsExceeded).toBe(false);
  });

  it('computes guard penalty', () => {
    const penaltyGuard: SuggestionGuard = {
      name: 'test',
      evaluate: () => ({ guardName: 'test', penalty: 0.3, reason: 'test' }),
    };
    const result = evaluateSail(makeSail(), 90, 12, densePolars, [], [penaltyGuard], cfg);

    expect(result.guards).toHaveLength(1);
    expect(result.reasoning.guardPenaltyTotal).toBeCloseTo(0.3, 5);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — moderate confidence
// ---------------------------------------------------------------------------
describe('evaluateSail — moderate confidence', () => {
  // Few polars, not close to target → moderate confidence
  const moderatePolars: PolarPoint[] = [
    { tws: 8, twa: 75, speed: 5.0 },
    { tws: 16, twa: 105, speed: 6.5 },
  ];

  it('classifies moderate confidence correctly', () => {
    const result = evaluateSail(makeSail(), 90, 12, moderatePolars, [], noGuards, cfg);

    // With 2 distant points, confidence lands between the moderate (0.35) and
    // high (0.65) thresholds.
    expect(result.confidenceTier).toBe('moderate');
    expect(result.predictedSpeed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — low confidence
// ---------------------------------------------------------------------------
describe('evaluateSail — low confidence', () => {
  it('classifies low confidence with sparse data', () => {
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, [], noGuards, cfg);

    expect(result.confidenceTier).toBe('low');
  });

  it('populates limitScore when limits are configured', () => {
    const limits = [makeLimitRow(10, 60, 120), makeLimitRow(15, 65, 125)];
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, limits, noGuards, cfg);

    expect(result.hasLimits).toBe(true);
    expect(result.limitScore).not.toBeNull();
  });

  it('returns null limitScore when no limits configured', () => {
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, [], noGuards, cfg);

    expect(result.hasLimits).toBe(false);
    expect(result.limitScore).toBeNull();
  });

  it('derives hasLimits false from rows with null min and max', () => {
    const limits = [makeLimitRow(10, null, null), makeLimitRow(15, null, null)];
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, limits, noGuards, cfg);

    // hasLimits is derived from the interpolated window, not the row count.
    expect(result.hasLimits).toBe(false);
    expect(result.limitScore).toBeNull();
    expect(result.reasoning.limitUsed).toBe(false);
  });

  it('still applies guard penalties', () => {
    const guard: SuggestionGuard = {
      name: 'test',
      evaluate: () => ({ guardName: 'test', penalty: 0.5, reason: 'test' }),
    };
    const result = evaluateSail(makeSail(), 90, 12, sparsePolars, [], [guard], cfg);

    expect(result.guards).toHaveLength(1);
    expect(result.reasoning.guardPenaltyTotal).toBeCloseTo(0.5, 5);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — wind zone classification
// ---------------------------------------------------------------------------
describe('evaluateSail — wind zone classification', () => {
  it('TWA=45° → upwind', () => {
    expect(evaluateSail(makeSail(), 45, 12, densePolars, [], noGuards, cfg).windZone).toBe('upwind');
  });

  it('TWA=60° → upwind', () => {
    expect(evaluateSail(makeSail(), 60, 12, densePolars, [], noGuards, cfg).windZone).toBe('upwind');
  });

  it('TWA=80° → reaching (boundary)', () => {
    expect(evaluateSail(makeSail(), 80, 12, densePolars, [], noGuards, cfg).windZone).toBe('reaching');
  });

  it('TWA=90° → reaching', () => {
    expect(evaluateSail(makeSail(), 90, 12, densePolars, [], noGuards, cfg).windZone).toBe('reaching');
  });

  it('TWA=150° → reaching (boundary)', () => {
    expect(evaluateSail(makeSail(), 150, 12, densePolars, [], noGuards, cfg).windZone).toBe('reaching');
  });

  it('TWA=151° → downwind', () => {
    expect(evaluateSail(makeSail(), 151, 12, densePolars, [], noGuards, cfg).windZone).toBe('downwind');
  });
});
