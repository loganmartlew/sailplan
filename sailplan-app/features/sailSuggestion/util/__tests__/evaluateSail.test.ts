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
    minTws: null,
    maxTws: null,
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
  // Two points that bracket the target in TWS only (both above it in TWA), so
  // coverage is partial (0.5) — enough to land between the moderate (0.35) and
  // high (0.65) thresholds. Fewer than minPoints, so no implicit envelope.
  const moderatePolars: PolarPoint[] = [
    { tws: 8, twa: 100, speed: 5.0 },
    { tws: 16, twa: 110, speed: 6.5 },
  ];

  it('classifies moderate confidence correctly', () => {
    const result = evaluateSail(makeSail(), 90, 12, moderatePolars, [], noGuards, cfg);

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
// evaluateSail — implicit coverage envelope (Package F)
// ---------------------------------------------------------------------------
describe('evaluateSail — implicit coverage envelope', () => {
  // A downwind band (TWA 125–140) with enough points to assert an envelope,
  // and no explicit limits.
  const bandPolars: PolarPoint[] = [];
  for (const tws of [10, 12, 14]) {
    for (const twa of [125, 130, 135, 140]) {
      bandPolars.push({ tws, twa, speed: 8 });
    }
  }

  it('scores an in-band angle through the trapezoid without suppressing trust', () => {
    // TWA 132 sits inside the observed band → limit score applies, positive, and
    // confidence is left at full strength (still high tier).
    const result = evaluateSail(makeSail(), 132, 12, bandPolars, [], noGuards, cfg);

    expect(result.hasLimits).toBe(false); // implicit, not user-entered
    expect(result.reasoning.limitUsed).toBe(true);
    expect(result.limitScore!).toBeGreaterThan(0);
    expect(result.limitsExceeded).toBe(false);
    expect(result.confidenceTier).toBe('high');
  });

  it('penalises and distrusts an angle the sail was never logged at', () => {
    // TWA 95 is ~30° below the band → out-of-range decay AND suppressed
    // confidence, so the extrapolated speed can no longer carry the ranking.
    const inBand = evaluateSail(makeSail(), 132, 12, bandPolars, [], noGuards, cfg);
    const outOfBand = evaluateSail(makeSail(), 95, 12, bandPolars, [], noGuards, cfg);

    expect(outOfBand.limitScore!).toBeLessThan(0);
    expect(outOfBand.limitsExceeded).toBe(true);
    // Trust is damped relative to the same sail evaluated inside its band.
    expect(outOfBand.confidence).toBeLessThan(inBand.confidence);
  });

  it('does not assert an envelope below minPoints', () => {
    const fewPoints: PolarPoint[] = [
      { tws: 12, twa: 130, speed: 8 },
      { tws: 12, twa: 135, speed: 8 },
    ];
    const result = evaluateSail(makeSail(), 90, 12, fewPoints, [], noGuards, cfg);

    // No envelope → scored on polars alone, exactly as before Package F.
    expect(result.limitScore).toBeNull();
    expect(result.reasoning.limitUsed).toBe(false);
  });

  it('lets explicit limits take precedence over the implicit envelope', () => {
    // Explicit limits [60,120] contradict the polar band (125–140). At TWA 90 —
    // inside the explicit window but outside the polar band — the explicit
    // limits win: positive score, flagged as user limits, trust not suppressed.
    const limits = [makeLimitRow(10, 60, 120), makeLimitRow(15, 60, 120)];
    const result = evaluateSail(makeSail(), 90, 12, bandPolars, limits, noGuards, cfg);

    expect(result.hasLimits).toBe(true);
    expect(result.limitScore!).toBeGreaterThan(0);
    expect(result.limitsExceeded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateSail — explicit limit trust suppression (Package H)
// ---------------------------------------------------------------------------
describe('evaluateSail — explicit limit trust suppression', () => {
  // A dense grid around a downwind band (TWA 150–180) → high raw confidence, so
  // any suppression is visible. Mirrors a fast asym whose polars extend past its
  // user limit.
  const grid: PolarPoint[] = [];
  for (const tws of [13, 15, 17]) {
    for (const twa of [150, 160, 170, 180]) {
      grid.push({ tws, twa, speed: 8 });
    }
  }

  it('zeroes trust for an angle outside the user window', () => {
    const limits = [makeLimitRow(15, 140, 165)];
    const inside = evaluateSail(makeSail(), 158, 15, grid, limits, noGuards, cfg);
    const outside = evaluateSail(makeSail(), 178, 15, grid, limits, noGuards, cfg);

    // 178° is past the user's max (165°): the extrapolated speed is not trusted.
    expect(outside.limitsExceeded).toBe(true);
    expect(outside.confidence).toBe(0);
    expect(outside.confidenceTier).toBe('low');
    // 158° is inside the window → trust survives.
    expect(inside.confidence).toBeGreaterThan(0);
  });

  it('keeps full trust across the whole in-window range, taper included', () => {
    // 163° sits in the trapezoid *taper* of a narrow [140,165] window but in the
    // *plateau* of a wide [140,200] one, so the two limit scores differ...
    const narrow = evaluateSail(makeSail(), 163, 15, grid, [makeLimitRow(15, 140, 165)], noGuards, cfg);
    const wide = evaluateSail(makeSail(), 163, 15, grid, [makeLimitRow(15, 140, 200)], noGuards, cfg);

    expect(narrow.limitScore!).toBeLessThan(wide.limitScore!);
    // ...yet an explicit window is a crisp yes/no: trust is full anywhere inside
    // it, so confidence is identical (unlike an implicit envelope, which damps
    // the taper). This is what protects a user-vouched edge angle.
    expect(narrow.confidence).toBe(wide.confidence);
    expect(narrow.confidence).toBeGreaterThan(0);
  });

  it('damps an implicit-envelope taper but not an explicit-limit one', () => {
    // A narrow data band (TWA 150–156) yields a narrow implicit envelope, so
    // 160° lands in *its* taper. A wide user window [140,175] puts the same 160°
    // in its *plateau*. Same sail/angle/polars — the only difference is whether
    // the limit is the user's (crisp) or inferred from coverage (fuzzy).
    const narrowBand: PolarPoint[] = [];
    for (const tws of [13, 15, 17]) {
      for (const twa of [150, 152, 154, 156]) {
        narrowBand.push({ tws, twa, speed: 8 });
      }
    }
    const explicit = evaluateSail(makeSail(), 160, 15, narrowBand, [makeLimitRow(15, 140, 175)], noGuards, cfg);
    const implicit = evaluateSail(makeSail(), 160, 15, narrowBand, [], noGuards, cfg);

    expect(explicit.hasLimits).toBe(true);
    expect(implicit.hasLimits).toBe(false); // implicit envelope, not user limits
    expect(explicit.limitScore!).toBeGreaterThan(0);
    expect(implicit.limitScore!).toBeGreaterThan(0);
    // Explicit keeps full trust in-window; the implicit envelope damps its taper.
    expect(explicit.confidence).toBeGreaterThan(implicit.confidence);
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
