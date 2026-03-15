import type { SailEvaluation } from '../../model/sailEvaluation';
import type { Sail } from '~/features/sail';
import { rankSails } from '../rankSails';

function makeSail(id: number, name: string): Sail {
  return {
    id,
    name,
    color: '#ffffff',
    sailArea: null,
    symmetrical: false,
    masthead: false,
    boatProfileId: 1,
  };
}

function makeEvaluation(
  overrides: Partial<SailEvaluation> & { sail: Sail },
): SailEvaluation {
  return {
    predictedSpeed: null,
    confidence: 0,
    confidenceTier: 'high',
    windZone: 'reaching',
    limitScore: null,
    hasLimits: false,
    limitsExceeded: false,
    polarScore: null,
    rankingScore: 0,
    guards: [],
    reasoning: {
      polarUsed: true,
      limitUsed: false,
      polarWeight: 0,
      limitWeight: 0,
      guardPenaltyTotal: 0,
      pointsUsed: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// rankSails
// ---------------------------------------------------------------------------
describe('rankSails', () => {
  it('normalizes polar scores and sorts descending', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'Sail A'),
        predictedSpeed: 4,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
      makeEvaluation({
        sail: makeSail(2, 'Sail B'),
        predictedSpeed: 6,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
      makeEvaluation({
        sail: makeSail(3, 'Sail C'),
        predictedSpeed: 3,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
    ];

    const { ranked } = rankSails(evals);

    // Sail B has max speed, so polarScore = 1.0
    expect(ranked[0].sail.name).toBe('Sail B');
    expect(ranked[0].polarScore).toBeCloseTo(1.0, 5);

    // Sail A polar = 4/6 ≈ 0.667
    const sailA = ranked.find(e => e.sail.name === 'Sail A')!;
    expect(sailA.polarScore).toBeCloseTo(4 / 6, 3);

    // Sail C polar = 3/6 = 0.5
    const sailC = ranked.find(e => e.sail.name === 'Sail C')!;
    expect(sailC.polarScore).toBeCloseTo(0.5, 3);
  });

  it('excludes -Infinity sails from suggested but keeps in evaluations', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'Good'),
        predictedSpeed: 6,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
      makeEvaluation({
        sail: makeSail(2, 'Bad'),
        predictedSpeed: null,
        confidence: 0,
        confidenceTier: 'low',
        // No limits → will get -Infinity
      }),
    ];

    const { ranked, suggested } = rankSails(evals);

    expect(ranked).toHaveLength(2);
    expect(ranked.find(e => e.sail.name === 'Bad')!.rankingScore).toBe(
      -Infinity,
    );
    expect(suggested.every(e => e.sail.name !== 'Bad')).toBe(true);
  });

  it('null-limitScore high-confidence: rankingScore = polarScore - guardPenalty', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: 6,
        confidence: 0.8,
        confidenceTier: 'high',
        limitScore: null,
        reasoning: {
          polarUsed: true,
          limitUsed: false,
          polarWeight: 0,
          limitWeight: 0,
          guardPenaltyTotal: 0.1,
          pointsUsed: [],
        },
      }),
    ];

    const { ranked } = rankSails(evals);
    // polarScore = 6/6 = 1.0, ranking = 1.0 - 0.1 = 0.9
    expect(ranked[0].rankingScore).toBeCloseTo(0.9, 5);
  });

  it('null-limitScore moderate-confidence: rankingScore = confidence × polarScore - guardPenalty', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: 6,
        confidence: 0.5,
        confidenceTier: 'moderate',
        limitScore: null,
        reasoning: {
          polarUsed: true,
          limitUsed: false,
          polarWeight: 0,
          limitWeight: 0,
          guardPenaltyTotal: 0,
          pointsUsed: [],
        },
      }),
    ];

    const { ranked } = rankSails(evals);
    // polarScore=1.0, ranking = 0.5 * 1.0 = 0.5
    expect(ranked[0].rankingScore).toBeCloseTo(0.5, 5);
  });

  it('null-limitScore low-confidence: rankingScore = -Infinity', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: 2,
        confidence: 0.1,
        confidenceTier: 'low',
        limitScore: null,
      }),
    ];

    const { ranked } = rankSails(evals);
    expect(ranked[0].rankingScore).toBe(-Infinity);
  });

  it('respects suggestion threshold (80%)', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'Leader'),
        predictedSpeed: 9,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
      makeEvaluation({
        sail: makeSail(2, 'Close'),
        predictedSpeed: 8,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
      makeEvaluation({
        sail: makeSail(3, 'Far'),
        predictedSpeed: 5,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
    ];

    const { suggested } = rankSails(evals);

    // Leader polar=1.0 (score≈1.0), Close polar=8/9≈0.889 (score≈0.889), Far polar=5/9≈0.556 (score≈0.556)
    // 80% of leader (1.0) = 0.8 → Close qualifies, Far doesn't
    expect(suggested).toHaveLength(2);
    expect(suggested.some(e => e.sail.name === 'Leader')).toBe(true);
    expect(suggested.some(e => e.sail.name === 'Close')).toBe(true);
    expect(suggested.some(e => e.sail.name === 'Far')).toBe(false);
  });

  it('caps suggested at 3 max', () => {
    const evals: SailEvaluation[] = Array.from({ length: 5 }, (_, i) =>
      makeEvaluation({
        sail: makeSail(i + 1, `Sail ${i + 1}`),
        predictedSpeed: 6,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
    );

    const { suggested } = rankSails(evals);
    expect(suggested.length).toBeLessThanOrEqual(3);
  });

  it('ensures at least 1 in suggested when eligible sails exist', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'Only'),
        predictedSpeed: 2,
        confidence: 0.8,
        confidenceTier: 'high',
      }),
    ];

    const { suggested } = rankSails(evals);
    expect(suggested).toHaveLength(1);
  });

  it('returns empty suggested when all sails are -Infinity', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: null,
        confidence: 0,
        confidenceTier: 'low',
        limitScore: null,
      }),
      makeEvaluation({
        sail: makeSail(2, 'B'),
        predictedSpeed: null,
        confidence: 0,
        confidenceTier: 'low',
        limitScore: null,
      }),
    ];

    const { ranked, suggested } = rankSails(evals);
    expect(ranked).toHaveLength(2);
    expect(suggested).toHaveLength(0);
  });
});
