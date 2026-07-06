import type { InterpolationConfig } from '~/features/sailPolar';

/**
 * Single source of truth for every tuning constant in the suggestion pipeline.
 *
 * The pipeline is pure: the config is threaded explicitly through
 * `suggestSails → evaluateSail → rankSails` (defaulting to
 * {@link DEFAULT_SUGGESTION_CONFIG}) rather than read from module state, so it
 * stays unit-testable and can later be driven by a user settings screen.
 */
export interface SuggestionConfig {
  /** Continuous confidence blend (rankSails). */
  blend: {
    /** Confidence at/below which ranking is pure limits (w = 0). */
    lowConfidence: number;
    /** Confidence at/above which ranking is pure polars (w = 1). */
    highConfidence: number;
    /** ε — evidence tiebreaker multiplied by raw confidence. */
    evidenceBonus: number;
  };
  /** Trapezoid limit curve (computeLimitScore). */
  limitCurve: {
    /** Fraction of the half-window that scores a flat 1.0. */
    plateauFraction: number;
    /** Score at the window edge (in-range floor). */
    edgeScore: number;
    /** Floor for out-of-range angles. */
    outsideFloor: number;
    /** Synthetic half-window for one-sided limits (degrees). */
    oneSidedOffsetDeg: number;
  };
  /**
   * Implicit TWA envelope (coverageEnvelope + evaluateSail). When a sail has
   * polar data but no explicit user limits, its own data coverage stands in as
   * a usable-range envelope (product decision D2): angles it was never logged
   * at are scored as out-of-range rather than trusted extrapolations.
   */
  coverageEnvelope: {
    /** Min polar points near the TWS region required to assert an envelope. */
    minPoints: number;
    /** Knots window around the target TWS used to gather "this region" points. */
    twsTolerance: number;
    /** Fraction trimmed from each end of the TWA span to reject stray outliers. */
    trimFraction: number;
    /** Outward expansion (degrees) of the observed TWA span, per side. */
    marginDeg: number;
  };
  /** Symmetry guard (symmetryGuard). */
  symmetryGuard: {
    /** No penalty for either symmetry inside this TWA band. */
    deadBandMinTwa: number;
    deadBandMaxTwa: number;
    penaltyPerDegree: number;
    maxPenalty: number;
    /** Trust user-entered TWA limits over the guard when they exist. */
    skipWhenLimitsDefined: boolean;
  };
  /**
   * Display-only tier labels after the continuous blend landed (single set —
   * zone-specific thresholds collapsed per finding 2.4). `moderate` doubles as
   * the normalisation gate for `maxSpeed` (finding 2.2).
   */
  confidenceTiers: { high: number; moderate: number };
  /** Suggestion selection (rankSails step 4). */
  selection: {
    /** Additive margin below the leader's score. */
    margin: number;
    maxSuggested: number;
    /** Leader score below which the result is flagged as a fallback pick. */
    fallbackScoreFloor: number;
  };
  /** Overrides passed through to sailPolar's estimateSailSpeed. */
  interpolation?: Partial<InterpolationConfig>;
}

export const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig = {
  blend: {
    lowConfidence: 0.25,
    highConfidence: 0.7,
    evidenceBonus: 0.05,
  },
  limitCurve: {
    plateauFraction: 0.7,
    edgeScore: 0.3,
    outsideFloor: -0.5,
    oneSidedOffsetDeg: 20,
  },
  coverageEnvelope: {
    minPoints: 4,
    twsTolerance: 6,
    trimFraction: 0.05,
    marginDeg: 5,
  },
  symmetryGuard: {
    deadBandMinTwa: 150,
    deadBandMaxTwa: 170,
    penaltyPerDegree: 0.01,
    maxPenalty: 0.2,
    skipWhenLimitsDefined: true,
  },
  confidenceTiers: { high: 0.65, moderate: 0.35 },
  selection: {
    margin: 0.15,
    maxSuggested: 3,
    fallbackScoreFloor: 0,
  },
};
