import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import { DEFAULT_SUGGESTION_CONFIG } from '../../model/suggestionConfig';
import { interpolateTwaLimits, computeLimitScore } from '../limitScoring';

const curve = DEFAULT_SUGGESTION_CONFIG.limitCurve;

// Helper to create SailTwaLimit rows (only tws/minTwa/maxTwa matter for scoring)
function makeLimitRow(
  tws: number,
  minTwa: number | null,
  maxTwa: number | null,
): SailTwaLimit {
  return { id: 0, sailId: 1, tws, minTwa, maxTwa };
}

// ---------------------------------------------------------------------------
// interpolateTwaLimits
// ---------------------------------------------------------------------------
describe('interpolateTwaLimits', () => {
  const limits: SailTwaLimit[] = [
    makeLimitRow(10, 60, 140),
    makeLimitRow(15, 70, 150),
  ];

  it('interpolates between TWS rows', () => {
    // TWS=12 is 40% from 10 to 15
    const result = interpolateTwaLimits(12, limits);
    expect(result.minTwa).toBeCloseTo(64, 1);
    expect(result.maxTwa).toBeCloseTo(144, 1);
  });

  it('returns exact values when TWS matches a row', () => {
    const result = interpolateTwaLimits(10, limits);
    expect(result.minTwa).toBe(60);
    expect(result.maxTwa).toBe(140);
  });

  it('clamps to lowest TWS row when below range', () => {
    const result = interpolateTwaLimits(3, limits);
    expect(result.minTwa).toBe(60);
    expect(result.maxTwa).toBe(140);
  });

  it('clamps to highest TWS row when above range', () => {
    const result = interpolateTwaLimits(35, limits);
    expect(result.minTwa).toBe(70);
    expect(result.maxTwa).toBe(150);
  });

  it('returns null for minTwa when one bounding row has minTwa=null', () => {
    const mixed: SailTwaLimit[] = [
      makeLimitRow(10, null, 140),
      makeLimitRow(15, null, 150),
    ];
    const result = interpolateTwaLimits(12, mixed);
    expect(result.minTwa).toBeNull();
    expect(result.maxTwa).toBeCloseTo(144, 1);
  });

  it('uses defined value when minTwa is defined at lower row but null at upper', () => {
    const mixed: SailTwaLimit[] = [
      makeLimitRow(10, 60, 140),
      makeLimitRow(15, null, 150),
    ];
    const result = interpolateTwaLimits(12, mixed);
    expect(result.minTwa).toBe(60); // Uses the defined value
    expect(result.maxTwa).toBeCloseTo(144, 1);
  });

  it('uses defined value when minTwa is null at lower row but defined at upper', () => {
    const mixed: SailTwaLimit[] = [
      makeLimitRow(10, null, 140),
      makeLimitRow(15, 70, 150),
    ];
    const result = interpolateTwaLimits(12, mixed);
    expect(result.minTwa).toBe(70);
    expect(result.maxTwa).toBeCloseTo(144, 1);
  });

  it('returns null for both when limits array is empty', () => {
    const result = interpolateTwaLimits(10, []);
    expect(result.minTwa).toBeNull();
    expect(result.maxTwa).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeLimitScore — trapezoid (plateauFraction 0.7, edgeScore 0.3)
// ---------------------------------------------------------------------------
describe('computeLimitScore', () => {
  // Range: minTwa=60, maxTwa=140 → center=100, halfRange=40

  it('is a flat 1.0 across the plateau (t = 0 and t = 0.7)', () => {
    expect(computeLimitScore(100, 60, 140, curve)).toBeCloseTo(1.0, 5);
    // t = 0.7 → 100 + 0.7 * 40 = 128 (plateau edge)
    expect(computeLimitScore(128, 60, 140, curve)).toBeCloseTo(1.0, 5);
    // Anywhere inside the plateau stays 1.0.
    expect(computeLimitScore(108, 60, 140, curve)).toBeCloseTo(1.0, 5);
  });

  it('tapers linearly from the plateau to edgeScore at the edge', () => {
    // Edge (t = 1): TWA 140 (and 60) → edgeScore 0.3.
    expect(computeLimitScore(140, 60, 140, curve)).toBeCloseTo(0.3, 5);
    expect(computeLimitScore(60, 60, 140, curve)).toBeCloseTo(0.3, 5);
    // Midway through the taper (t = 0.85) → 1 - 0.5 * (1 - 0.3) = 0.65.
    expect(computeLimitScore(100 + 0.85 * 40, 60, 140, curve)).toBeCloseTo(
      0.65,
      5,
    );
  });

  it('in-range edge beats just-outside by a margin (deliberate discontinuity)', () => {
    const insideEdge = computeLimitScore(140, 60, 140, curve)!; // 0.3
    const justOutside = computeLimitScore(140.4, 60, 140, curve)!; // slightly < 0
    expect(insideEdge).toBeGreaterThan(justOutside);
    expect(insideEdge - justOutside).toBeGreaterThan(0.25);
  });

  it('returns slightly negative just outside range', () => {
    // TWA=145 → t = |145-100|/40 = 1.125, outside → -0.5*(1.125-1) = -0.0625
    const score = computeLimitScore(145, 60, 140, curve)!;
    expect(score).toBeLessThan(0);
    expect(score).toBeGreaterThan(-0.5);
  });

  it('clamps at -0.5 floor for far-outside TWA', () => {
    // TWA=200 → t = 100/40 = 2.5, outside → -0.5*(2.5-1) = -0.75 → clamped to -0.5
    expect(computeLimitScore(200, 60, 140, curve)).toBeCloseTo(-0.5, 2);
  });

  it('returns null when both limits are null', () => {
    expect(computeLimitScore(100, null, null, curve)).toBeNull();
  });

  it('scores correctly for one-sided minTwa only (center = minTwa+20)', () => {
    // Only minTwa=60 → center=80, halfRange=20; plateau covers t ≤ 0.7.
    expect(computeLimitScore(80, 60, null, curve)).toBeCloseTo(1.0, 5);
    // At minTwa itself: t = |60-80|/20 = 1.0 → edgeScore 0.3.
    expect(computeLimitScore(60, 60, null, curve)).toBeCloseTo(0.3, 5);
  });

  it('scores correctly for one-sided maxTwa only (center = maxTwa-20)', () => {
    // Only maxTwa=140 → center=120, halfRange=20.
    expect(computeLimitScore(120, null, 140, curve)).toBeCloseTo(1.0, 5);
    // At maxTwa itself: t = |140-120|/20 = 1.0 → edgeScore 0.3.
    expect(computeLimitScore(140, null, 140, curve)).toBeCloseTo(0.3, 5);
  });

  it('does not punish an in-window deep angle (headline downwind case)', () => {
    // Asym window 100–160, sailed at the deep edge 155° → t ≈ 0.833.
    // Old bell curve scored ≈ 0.07; trapezoid keeps it high.
    const score = computeLimitScore(155, 100, 160, curve)!;
    expect(score).toBeGreaterThan(0.6);
  });

  it('is monotonically non-increasing from center to edge', () => {
    const at25 = computeLimitScore(100 + 0.25 * 40, 60, 140, curve)!;
    const at50 = computeLimitScore(100 + 0.5 * 40, 60, 140, curve)!;
    const at75 = computeLimitScore(100 + 0.75 * 40, 60, 140, curve)!;
    expect(at25).toBeGreaterThanOrEqual(at50);
    expect(at50).toBeGreaterThanOrEqual(at75);
  });
});
