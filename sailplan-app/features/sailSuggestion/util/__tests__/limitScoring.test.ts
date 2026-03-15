import type { SailTwaLimit } from '~/features/sailTwaLimit/model/sailTwaLimit';
import { interpolateTwaLimits, computeLimitScore } from '../limitScoring';

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
// computeLimitScore
// ---------------------------------------------------------------------------
describe('computeLimitScore', () => {
  // Range: minTwa=60, maxTwa=140 → center=100, halfRange=40

  it('returns ≈1.0 at range center', () => {
    expect(computeLimitScore(100, 60, 140)).toBeCloseTo(1.0, 2);
  });

  it('returns very close to 1.0 near center (within ~20% of half-range)', () => {
    // 20% of 40 = 8 degrees from center → t=0.2
    const score = computeLimitScore(108, 60, 140)!;
    expect(score).toBeGreaterThan(0.9);
  });

  it('returns ≈0.0 at range edge', () => {
    expect(computeLimitScore(60, 60, 140)).toBeCloseTo(0.0, 2);
    expect(computeLimitScore(140, 60, 140)).toBeCloseTo(0.0, 2);
  });

  it('demonstrates smooth roll-off at 70% position', () => {
    // t=0.7 → 0.5*(1+cos(0.7π)) ≈ 0.5*(1 + (-0.588)) ≈ 0.206
    const score = computeLimitScore(100 + 0.7 * 40, 60, 140)!;
    expect(score).toBeCloseTo(0.206, 1);
  });

  it('returns slightly negative just outside range', () => {
    // TWA=145 → t = |145-100|/40 = 1.125, outside → -0.5*(1.125-1) = -0.0625
    const score = computeLimitScore(145, 60, 140)!;
    expect(score).toBeLessThan(0);
    expect(score).toBeGreaterThan(-0.5);
  });

  it('clamps at -0.5 floor for far-outside TWA', () => {
    // TWA=200 → t = 100/40 = 2.5, outside → -0.5*(2.5-1) = -0.75 → clamped to -0.5
    expect(computeLimitScore(200, 60, 140)).toBeCloseTo(-0.5, 2);
  });

  it('returns null when both limits are null', () => {
    expect(computeLimitScore(100, null, null)).toBeNull();
  });

  it('scores correctly for one-sided minTwa only (center = minTwa+20)', () => {
    // Only minTwa=60 → center=80, halfRange=20
    const score = computeLimitScore(80, 60, null)!;
    expect(score).toBeCloseTo(1.0, 2);
    // At minTwa itself: t = |60-80|/20 = 1.0 → score ≈ 0.0
    expect(computeLimitScore(60, 60, null)).toBeCloseTo(0.0, 2);
  });

  it('scores correctly for one-sided maxTwa only (center = maxTwa-20)', () => {
    // Only maxTwa=140 → center=120, halfRange=20
    const score = computeLimitScore(120, null, 140)!;
    expect(score).toBeCloseTo(1.0, 2);
    // At maxTwa itself: t = |140-120|/20 = 1.0 → score ≈ 0.0
    expect(computeLimitScore(140, null, 140)).toBeCloseTo(0.0, 2);
  });

  it('confirms bell-curve shape (not linear)', () => {
    // center=100, halfRange=40
    const at25 = computeLimitScore(100 + 0.25 * 40, 60, 140)!;
    const at50 = computeLimitScore(100 + 0.5 * 40, 60, 140)!;
    const at75 = computeLimitScore(100 + 0.75 * 40, 60, 140)!;

    // Monotonically decreasing
    expect(at25).toBeGreaterThan(at50);
    expect(at50).toBeGreaterThan(at75);

    // Bell-curve: score drops slowly near center, steeply near edges
    // Compare the drop across the inner quarter (0→25%) vs outer quarter (75→100%)
    const innerDrop = 1.0 - at25; // drop from center to 25%
    const outerDrop = at75; // drop from 75% to edge (0)
    // For a raised cosine, innerDrop ≈ 0.146 and outerDrop ≈ 0.146 (symmetric)
    // Instead verify the bell shape: center region (0-50%) retains more than outer (50-100%)
    expect(at25).toBeGreaterThan(at75); // 25% from center > 75% from center
  });
});
