import type { WindZone } from './windZone';

export type ConfidenceTier = 'high' | 'moderate' | 'low';

export interface ConfidenceThresholds {
  high: number;
  moderate: number;
}

export const CONFIDENCE_THRESHOLDS: Record<WindZone, ConfidenceThresholds> = {
  upwind: { high: 0.7, moderate: 0.4 },
  reaching: { high: 0.6, moderate: 0.3 },
  downwind: { high: 0.65, moderate: 0.35 },
};

export function classifyConfidence(
  confidence: number,
  zone: WindZone,
): ConfidenceTier {
  const thresholds = CONFIDENCE_THRESHOLDS[zone];
  if (confidence >= thresholds.high) return 'high';
  if (confidence >= thresholds.moderate) return 'moderate';
  return 'low';
}
