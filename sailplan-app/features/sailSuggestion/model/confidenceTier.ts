export type ConfidenceTier = 'high' | 'moderate' | 'low';

export interface ConfidenceThresholds {
  high: number;
  moderate: number;
}

/**
 * Buckets a raw confidence value (0–1) into a discrete tier.
 *
 * Since the continuous blend landed (finding 1.1), the tier is a **display
 * label only** — nothing in ranking branches on it. The per-zone threshold
 * record was collapsed to a single set (finding 2.4); pass
 * `config.confidenceTiers`.
 */
export function classifyConfidence(
  confidence: number,
  thresholds: ConfidenceThresholds,
): ConfidenceTier {
  if (confidence >= thresholds.high) return 'high';
  if (confidence >= thresholds.moderate) return 'moderate';
  return 'low';
}
