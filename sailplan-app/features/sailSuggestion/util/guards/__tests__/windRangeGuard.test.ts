import type { Sail } from '~/features/sail';
import type { GuardContext } from '../../../model/guard';
import { DEFAULT_SUGGESTION_CONFIG } from '../../../model/suggestionConfig';
import { getWindZone } from '../../../model/windZone';
import { windRangeGuard } from '../../guards/windRangeGuard';

function makeSail(minTws: number | null, maxTws: number | null): Sail {
  return {
    id: 1,
    name: 'Test Sail',
    color: '#ffffff',
    sailArea: null,
    symmetrical: false,
    masthead: false,
    minTws,
    maxTws,
    boatProfileId: 1,
  };
}

function makeCtx(sail: Sail, tws: number): GuardContext {
  return {
    sail,
    twa: 140,
    tws,
    windZone: getWindZone(140),
    limits: { minTwa: null, maxTwa: null },
    hasLimits: false,
    confidence: 0.5,
    config: DEFAULT_SUGGESTION_CONFIG,
  };
}

// Defaults: penaltyPerKnot 0.5, maxPenalty 2.0 → cap reached 4 kt past the edge.
describe('windRangeGuard', () => {
  it('no penalty with no range set (both null)', () => {
    const sail = makeSail(null, null);
    expect(windRangeGuard.evaluate(makeCtx(sail, 5))).toBeNull();
    expect(windRangeGuard.evaluate(makeCtx(sail, 40))).toBeNull();
  });

  it('no penalty inside a two-sided range (incl. boundaries)', () => {
    const sail = makeSail(8, 18);
    expect(windRangeGuard.evaluate(makeCtx(sail, 8))).toBeNull();
    expect(windRangeGuard.evaluate(makeCtx(sail, 12))).toBeNull();
    expect(windRangeGuard.evaluate(makeCtx(sail, 18))).toBeNull();
  });

  it('ramps linearly above the max (18 kt ceiling, +2 kt → 1.0)', () => {
    const sail = makeSail(null, 18);
    const result = windRangeGuard.evaluate(makeCtx(sail, 20))!;
    expect(result).not.toBeNull();
    expect(result.penalty).toBeCloseTo(1.0, 5);
    expect(result.guardName).toBe('windRange');
    expect(result.reason).toContain('18');
    expect(result.reason).toContain('above');
  });

  it('ramps linearly below the min (10 kt floor, −3 kt → 1.5)', () => {
    const sail = makeSail(10, null);
    const result = windRangeGuard.evaluate(makeCtx(sail, 7))!;
    expect(result.penalty).toBeCloseTo(1.5, 5);
    expect(result.reason).toContain('below');
  });

  it('caps the penalty at maxPenalty for a large excess', () => {
    const sail = makeSail(null, 18);
    const result = windRangeGuard.evaluate(makeCtx(sail, 30))!;
    expect(result.penalty).toBeCloseTo(2.0, 5);
  });

  it('a one-sided max is unbounded below (no floor penalty)', () => {
    const sail = makeSail(null, 18);
    expect(windRangeGuard.evaluate(makeCtx(sail, 3))).toBeNull();
  });
});
