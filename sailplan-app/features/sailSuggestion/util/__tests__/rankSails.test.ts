import type { Sail } from '~/features/sail';
import type { SailEvaluation } from '../../model/sailEvaluation';
import { DEFAULT_SUGGESTION_CONFIG } from '../../model/suggestionConfig';
import { rankSails } from '../rankSails';

const config = DEFAULT_SUGGESTION_CONFIG;

function makeSail(id: number, name: string): Sail {
  return {
    id,
    name,
    color: '#ffffff',
    sailArea: null,
    symmetrical: false,
    masthead: false,
    minTws: null,
    maxTws: null,
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
    guards: [],
    reasoning: {
      polarUsed: true,
      limitUsed: false,
      guardPenaltyTotal: 0,
      pointsUsed: [],
      usableTwa: { minTwa: null, maxTwa: null },
    },
    ...overrides,
  };
}

// smoothstep(0.8, 0.25, 0.7) clamps to 1 → high-confidence sails have w = 1;
// ε·confidence (0.05·0.8 = 0.04) is the evidence bonus on polar-bearing sails.
describe('rankSails', () => {
  it('normalizes polar scores and sorts descending', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'Sail A'), predictedSpeed: 4, confidence: 0.8 }),
      makeEvaluation({ sail: makeSail(2, 'Sail B'), predictedSpeed: 6, confidence: 0.8 }),
      makeEvaluation({ sail: makeSail(3, 'Sail C'), predictedSpeed: 3, confidence: 0.8 }),
    ];

    const { ranked } = rankSails(evals, config);

    expect(ranked[0].sail.name).toBe('Sail B');
    expect(ranked[0].polarScore).toBeCloseTo(1.0, 5);
    expect(ranked.find(e => e.sail.name === 'Sail A')!.polarScore).toBeCloseTo(4 / 6, 3);
    expect(ranked.find(e => e.sail.name === 'Sail C')!.polarScore).toBeCloseTo(0.5, 3);
  });

  it('excludes -Infinity sails from suggested but keeps in evaluations', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'Good'), predictedSpeed: 6, confidence: 0.8 }),
      makeEvaluation({ sail: makeSail(2, 'Bad'), predictedSpeed: null, confidence: 0 }),
    ];

    const { ranked, suggested } = rankSails(evals, config);

    expect(ranked).toHaveLength(2);
    expect(ranked.find(e => e.sail.name === 'Bad')!.rankingScore).toBe(-Infinity);
    expect(suggested.every(e => e.sail.name !== 'Bad')).toBe(true);
  });

  it('blends polar and limit scores with the smoothstep weight', () => {
    // confidence 0.475 → smoothstep = 0.5; single sail → polarScore 1.0.
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: 6,
        confidence: 0.475,
        limitScore: 0.6,
        hasLimits: true,
      }),
    ];

    const { ranked } = rankSails(evals, config);
    // 0.5·1.0 + 0.5·0.6 + 0.05·0.475 = 0.82375
    expect(ranked[0].rankingScore).toBeCloseTo(0.82375, 5);
    expect(ranked[0].reasoning.polarWeight).toBeCloseTo(0.5, 5);
    expect(ranked[0].reasoning.limitWeight).toBeCloseTo(0.5, 5);
  });

  it('null-limitScore, high confidence: w·polarScore + ε·confidence − guard', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: 6,
        confidence: 0.8,
        limitScore: null,
        reasoning: {
          polarUsed: true,
          limitUsed: false,
          guardPenaltyTotal: 0.1,
          pointsUsed: [],
          usableTwa: { minTwa: null, maxTwa: null },
        },
      }),
    ];

    const { ranked } = rankSails(evals, config);
    // 1.0·1.0 + 0.05·0.8 − 0.1 = 0.94
    expect(ranked[0].rankingScore).toBeCloseTo(0.94, 5);
  });

  it('no polars, with limits: rankingScore = limitScore − guard (pure limits)', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({
        sail: makeSail(1, 'A'),
        predictedSpeed: null,
        confidence: 0,
        limitScore: 0.7,
        hasLimits: true,
      }),
    ];

    const { ranked } = rankSails(evals, config);
    expect(ranked[0].rankingScore).toBeCloseTo(0.7, 5);
    expect(ranked[0].reasoning.polarWeight).toBe(0);
    expect(ranked[0].reasoning.limitWeight).toBe(1);
  });

  it('no polars, no limits: rankingScore = -Infinity', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'A'), predictedSpeed: null, confidence: 0, limitScore: null }),
    ];
    const { ranked } = rankSails(evals, config);
    expect(ranked[0].rankingScore).toBe(-Infinity);
  });

  it('gates normalisation: a low-confidence over-estimate does not deflate trusted sails', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'Trusted'), predictedSpeed: 6, confidence: 0.8 }),
      // Garbage 100 kn estimate at confidence 0.1 (below the 0.35 gate).
      makeEvaluation({ sail: makeSail(2, 'Garbage'), predictedSpeed: 100, confidence: 0.1 }),
    ];

    const { ranked } = rankSails(evals, config);
    // maxSpeed comes from the trusted pool (6), so Trusted keeps polarScore 1.0.
    expect(ranked.find(e => e.sail.name === 'Trusted')!.polarScore).toBeCloseTo(1.0, 5);
    expect(ranked[0].sail.name).toBe('Trusted');
  });

  it('selects within the additive margin of the leader', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'Leader'), predictedSpeed: 9, confidence: 0.8 }),
      makeEvaluation({ sail: makeSail(2, 'Close'), predictedSpeed: 8, confidence: 0.8 }),
      makeEvaluation({ sail: makeSail(3, 'Far'), predictedSpeed: 5, confidence: 0.8 }),
    ];

    const { suggested } = rankSails(evals, config);
    // Leader 1.04, Close 0.929, Far 0.596; margin 0.15 → threshold 0.89.
    expect(suggested).toHaveLength(2);
    expect(suggested.some(e => e.sail.name === 'Leader')).toBe(true);
    expect(suggested.some(e => e.sail.name === 'Close')).toBe(true);
    expect(suggested.some(e => e.sail.name === 'Far')).toBe(false);
  });

  it('caps suggested at 3 max', () => {
    const evals: SailEvaluation[] = Array.from({ length: 5 }, (_, i) =>
      makeEvaluation({ sail: makeSail(i + 1, `Sail ${i + 1}`), predictedSpeed: 6, confidence: 0.8 }),
    );

    const { suggested } = rankSails(evals, config);
    expect(suggested.length).toBeLessThanOrEqual(3);
  });

  it('handles a negative leader: non-empty fallback flagged via isFallback', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'LeastBad'), predictedSpeed: null, confidence: 0, limitScore: -0.2, hasLimits: true }),
      makeEvaluation({ sail: makeSail(2, 'Worse'), predictedSpeed: null, confidence: 0, limitScore: -0.4, hasLimits: true }),
    ];

    const { suggested, isFallback } = rankSails(evals, config);
    expect(isFallback).toBe(true);
    expect(suggested.length).toBeGreaterThanOrEqual(1);
    expect(suggested[0].sail.name).toBe('LeastBad');
  });

  it('returns empty suggested (and no fallback) when all sails are -Infinity', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'A'), predictedSpeed: null, confidence: 0, limitScore: null }),
      makeEvaluation({ sail: makeSail(2, 'B'), predictedSpeed: null, confidence: 0, limitScore: null }),
    ];

    const { ranked, suggested, isFallback } = rankSails(evals, config);
    expect(ranked).toHaveLength(2);
    expect(suggested).toHaveLength(0);
    expect(isFallback).toBe(false);
  });

  it('rankingScore is continuous in confidence (no cliffs)', () => {
    // Sweep confidence 0→1 with fixed polar/limit inputs; each 0.01 step must
    // move the score by < 0.02 (the old tier switch jumped by ~0.18).
    let previous: number | null = null;
    for (let c = 0; c <= 1.0001; c += 0.01) {
      const confidence = Math.min(1, c);
      const { ranked } = rankSails(
        [
          makeEvaluation({
            sail: makeSail(1, 'A'),
            predictedSpeed: 6, // sole sail → polarScore 1.0
            confidence,
            limitScore: 0.5,
            hasLimits: true,
          }),
        ],
        config,
      );
      const score = ranked[0].rankingScore;
      if (previous !== null) {
        expect(Math.abs(score - previous)).toBeLessThan(0.02);
      }
      previous = score;
    }
  });

  it('does not mutate its input and returns new records', () => {
    const evals: SailEvaluation[] = [
      makeEvaluation({ sail: makeSail(1, 'A'), predictedSpeed: 6, confidence: 0.8, limitScore: 0.5, hasLimits: true }),
      makeEvaluation({ sail: makeSail(2, 'B'), predictedSpeed: 4, confidence: 0.8, limitScore: 0.9, hasLimits: true }),
    ];
    // Freezing throws if rankSails tries to write to the inputs.
    for (const e of evals) {
      Object.freeze(e);
      Object.freeze(e.reasoning);
    }

    const { ranked } = rankSails(evals, config);

    // New records — no shared references with the input array.
    expect(ranked.every(r => !evals.includes(r as unknown as SailEvaluation))).toBe(true);
    // Inputs still lack the ranking-only fields.
    expect(evals[0]).not.toHaveProperty('rankingScore');
    expect(evals[0].reasoning).not.toHaveProperty('polarWeight');
  });
});
