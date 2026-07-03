import type { Sail } from '~/features/sail';
import type { GuardContext } from '../../../model/guard';
import { DEFAULT_SUGGESTION_CONFIG } from '../../../model/suggestionConfig';
import { getWindZone } from '../../../model/windZone';
import { symmetryGuard } from '../../guards/symmetryGuard';

function makeSail(symmetrical: boolean): Sail {
  return {
    id: 1,
    name: 'Test Sail',
    color: '#ffffff',
    sailArea: null,
    symmetrical,
    masthead: false,
    boatProfileId: 1,
  };
}

function makeCtx(
  sail: Sail,
  twa: number,
  overrides: Partial<GuardContext> = {},
): GuardContext {
  return {
    sail,
    twa,
    tws: 12,
    windZone: getWindZone(twa),
    limits: { minTwa: null, maxTwa: null },
    hasLimits: false,
    confidence: 0.5,
    config: DEFAULT_SUGGESTION_CONFIG,
    ...overrides,
  };
}

// Defaults: dead band 150–170°, 0.01/°, cap 0.2, skipWhenLimitsDefined true.
describe('symmetryGuard', () => {
  describe('symmetric sails', () => {
    const sail = makeSail(true);

    it('returns null inside the dead band (150/160/170°)', () => {
      expect(symmetryGuard.evaluate(makeCtx(sail, 150))).toBeNull();
      expect(symmetryGuard.evaluate(makeCtx(sail, 160))).toBeNull();
      expect(symmetryGuard.evaluate(makeCtx(sail, 170))).toBeNull();
    });

    it('applies a small penalty below the dead band (140° → 0.10)', () => {
      const result = symmetryGuard.evaluate(makeCtx(sail, 140))!;
      expect(result).not.toBeNull();
      expect(result.penalty).toBeCloseTo(0.1, 5);
      expect(result.guardName).toBe('symmetry');
    });

    it('caps the penalty at 0.2 for large offsets (100°)', () => {
      const result = symmetryGuard.evaluate(makeCtx(sail, 100))!;
      expect(result.penalty).toBeCloseTo(0.2, 5);
    });
  });

  describe('asymmetric sails', () => {
    const sail = makeSail(false);

    it('returns null inside the dead band (150/160/170°)', () => {
      expect(symmetryGuard.evaluate(makeCtx(sail, 150))).toBeNull();
      expect(symmetryGuard.evaluate(makeCtx(sail, 160))).toBeNull();
      expect(symmetryGuard.evaluate(makeCtx(sail, 170))).toBeNull();
    });

    it('applies a small penalty above the dead band (175° → 0.05)', () => {
      const result = symmetryGuard.evaluate(makeCtx(sail, 175))!;
      expect(result).not.toBeNull();
      expect(result.penalty).toBeCloseTo(0.05, 5);
    });

    it('caps the penalty at 0.2 for large offsets (190°)', () => {
      const result = symmetryGuard.evaluate(makeCtx(sail, 190))!;
      expect(result.penalty).toBeCloseTo(0.2, 5);
    });
  });

  describe('skipWhenLimitsDefined', () => {
    it('defers to user-entered limits (no penalty when hasLimits)', () => {
      const sail = makeSail(true);
      const result = symmetryGuard.evaluate(
        makeCtx(sail, 140, { hasLimits: true }),
      );
      expect(result).toBeNull();
    });

    it('still runs when the flag is off', () => {
      const sail = makeSail(true);
      const config = {
        ...DEFAULT_SUGGESTION_CONFIG,
        symmetryGuard: {
          ...DEFAULT_SUGGESTION_CONFIG.symmetryGuard,
          skipWhenLimitsDefined: false,
        },
      };
      const result = symmetryGuard.evaluate(
        makeCtx(sail, 140, { hasLimits: true, config }),
      );
      expect(result).not.toBeNull();
      expect(result!.penalty).toBeCloseTo(0.1, 5);
    });
  });
});
