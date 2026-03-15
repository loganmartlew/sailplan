import type { Sail } from '~/features/sail';
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

describe('symmetryGuard', () => {
  describe('symmetric sails', () => {
    const sail = makeSail(true);

    it('returns null at TWA=170° (no penalty)', () => {
      expect(symmetryGuard.evaluate(sail, 170, 12)).toBeNull();
    });

    it('returns null at TWA=160° (boundary, no penalty)', () => {
      expect(symmetryGuard.evaluate(sail, 160, 12)).toBeNull();
    });

    it('applies penalty at TWA=150° (10° past → 0.5)', () => {
      const result = symmetryGuard.evaluate(sail, 150, 12)!;
      expect(result).not.toBeNull();
      expect(result.penalty).toBeCloseTo(0.5, 5);
      expect(result.guardName).toBe('symmetry');
    });

    it('applies capped penalty at TWA=140° (20° past → 1.0)', () => {
      const result = symmetryGuard.evaluate(sail, 140, 12)!;
      expect(result.penalty).toBeCloseTo(1.0, 5);
    });

    it('caps penalty at 1.0 for large offsets (TWA=90°)', () => {
      const result = symmetryGuard.evaluate(sail, 90, 12)!;
      expect(result.penalty).toBe(1.0);
    });
  });

  describe('asymmetric sails', () => {
    const sail = makeSail(false);

    it('returns null at TWA=150° (no penalty)', () => {
      expect(symmetryGuard.evaluate(sail, 150, 12)).toBeNull();
    });

    it('returns null at TWA=160° (boundary, no penalty)', () => {
      expect(symmetryGuard.evaluate(sail, 160, 12)).toBeNull();
    });

    it('applies penalty at TWA=165° (5° past → 0.25)', () => {
      const result = symmetryGuard.evaluate(sail, 165, 12)!;
      expect(result).not.toBeNull();
      expect(result.penalty).toBeCloseTo(0.25, 5);
    });

    it('applies penalty at TWA=175° (15° past → 0.75)', () => {
      const result = symmetryGuard.evaluate(sail, 175, 12)!;
      expect(result.penalty).toBeCloseTo(0.75, 5);
    });

    it('caps penalty at 1.0 at TWA=180° (20° past)', () => {
      const result = symmetryGuard.evaluate(sail, 180, 12)!;
      expect(result.penalty).toBeCloseTo(1.0, 5);
    });
  });
});
