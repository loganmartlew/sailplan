import type { PolarPoint } from '~/features/sailPolar/model/interpolation';
import { DEFAULT_SUGGESTION_CONFIG } from '../../model/suggestionConfig';
import { deriveCoverageEnvelope } from '../coverageEnvelope';

const cfg = DEFAULT_SUGGESTION_CONFIG.coverageEnvelope;

/** A band of `count` points per TWA node across the given TWS values. */
function band(
  twsValues: number[],
  twaValues: number[],
  perNode = 1,
): PolarPoint[] {
  const points: PolarPoint[] = [];
  for (const tws of twsValues) {
    for (const twa of twaValues) {
      for (let i = 0; i < perNode; i++) points.push({ tws, twa, speed: 6 });
    }
  }
  return points;
}

describe('deriveCoverageEnvelope', () => {
  it('returns null with no polar data', () => {
    expect(deriveCoverageEnvelope(12, [], cfg)).toBeNull();
  });

  it('returns null below minPoints (a span needs evidence)', () => {
    const sparse = band([12], [130, 135], 1); // 2 points < minPoints 4
    expect(deriveCoverageEnvelope(12, sparse, cfg)).toBeNull();
  });

  it('derives [min−margin, max+margin] from the observed TWA span', () => {
    const points = band([10, 12, 14], [125, 130, 135, 140], 1); // 12 points
    const env = deriveCoverageEnvelope(12, points, cfg);
    expect(env).not.toBeNull();
    expect(env!.minTwa).toBeCloseTo(125 - cfg.marginDeg, 5);
    expect(env!.maxTwa).toBeCloseTo(140 + cfg.marginDeg, 5);
  });

  it('rejects a lone outlier via the trim (a glitch cannot balloon the band)', () => {
    // 20 well-behaved points in [120,140] + 1 wild outlier at 60°. With
    // trimFraction 0.05, floor(0.05·21)=1 point is trimmed off each end, so the
    // 60° glitch is dropped rather than defining the envelope.
    const points = [...band([10, 12], [120, 130, 140], 3), ...band([12], [125, 135], 1)];
    points.push({ tws: 12, twa: 60, speed: 6 });
    expect(points.length).toBeGreaterThanOrEqual(21);

    const env = deriveCoverageEnvelope(12, points, cfg);
    expect(env!.minTwa).toBeGreaterThan(100); // not anywhere near the 60° glitch
  });

  it('scopes the envelope to the TWS region around the target', () => {
    // A downwind band near TWS 12, plus a stray wide-angle cluster way out at
    // TWS 40. With twsTolerance 6, only the near band defines the envelope.
    const near = band([10, 12, 14], [150, 160, 170], 1); // 9 near points
    const farOff = band([40], [95, 100], 3); // outside the TWS window
    const env = deriveCoverageEnvelope(12, [...near, ...farOff], cfg);
    expect(env!.minTwa).toBeCloseTo(150 - cfg.marginDeg, 5);
    expect(env!.maxTwa).toBeCloseTo(170 + cfg.marginDeg, 5);
  });

  it('falls back to the full point set when the local TWS window is too sparse', () => {
    // Nothing within twsTolerance of TWS 40, but enough points overall: the
    // envelope is asserted from the whole set rather than abandoned.
    const points = band([10, 12, 14], [130, 135, 140], 1); // 9 points, all far in TWS
    const env = deriveCoverageEnvelope(40, points, cfg);
    expect(env).not.toBeNull();
    expect(env!.minTwa).toBeCloseTo(130 - cfg.marginDeg, 5);
    expect(env!.maxTwa).toBeCloseTo(140 + cfg.marginDeg, 5);
  });
});
