import type { CaptureSession } from './capture';
import type { CaptureHealth } from '../util/replayCaptureSession';

export const LOW_WIND_CONFIDENCE_KNOTS = 6;

export interface CaptureSessionAggregate {
  session: CaptureSession;
  sampleCount: number;
  usableSampleCount: number;
  minTws: number | null;
  maxTws: number | null;
}

export interface CaptureSessionSummary {
  id: number;
  name: string;
  /** The course this session recorded, if one was linked. */
  courseId: number | null;
  startedAt: number;
  durationMs: number;
  sampleCount: number;
  state: 'good' | 'failed';
  windRange: { min: number; max: number } | null;
  windFrame: CaptureSession['windFrame'];
  warnsGroundWind: boolean;
  lowWindConfidence: boolean;
  failureExplanation: string | null;
}

const emptyHealth = (): CaptureHealth => ({
  overLengthLines: 0,
  rejects: {},
  stale: {},
});

function parseHealth(value: string): CaptureHealth {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return emptyHealth();
    const candidate = parsed as Partial<CaptureHealth>;
    return {
      overLengthLines:
        typeof candidate.overLengthLines === 'number'
          ? candidate.overLengthLines
          : 0,
      rejects:
        candidate.rejects && typeof candidate.rejects === 'object'
          ? candidate.rejects
          : {},
      stale:
        candidate.stale && typeof candidate.stale === 'object'
          ? candidate.stale
          : {},
    };
  } catch {
    return emptyHealth();
  }
}

function positiveCounters(counters: Record<string, number>) {
  return Object.entries(counters)
    .filter((entry): entry is [string, number] =>
      Number.isFinite(entry[1]) && entry[1] > 0,
    )
    .sort((left, right) => right[1] - left[1]);
}

function describeCounters(
  counters: [string, number][],
  label: (name: string, count: number) => string,
) {
  return counters.map(([name, count]) => label(name, count)).join(', ');
}

function failureExplanation(healthText: string): string {
  const health = parseHealth(healthText);
  const rejects = positiveCounters(health.rejects);
  const stale = positiveCounters(health.stale);

  if (rejects.length > 0) {
    const details = describeCounters(
      rejects,
      (formatter, count) =>
        `${count} ${formatter} ${count === 1 ? 'sentence' : 'sentences'}`,
    );
    const staleDetails = describeCounters(
      stale,
      (field, count) => `${field.toUpperCase()} (${count})`,
    );
    return `The instruments sent invalid NMEA data: ${details} were rejected.${staleDetails ? ` Required readings also stopped arriving: ${staleDetails}.` : ''} Check the affected instruments and their NMEA output.`;
  }

  if (stale.length > 0) {
    const details = describeCounters(
      stale,
      (field, count) => `${field.toUpperCase()} (${count})`,
    );
    return `Required readings stopped arriving often enough that no sample was usable: ${details}. Check those instruments and their network connection.`;
  }

  return 'The recording contains no complete instrument samples. The connection or instrument feed stopped before usable wind and boat-speed data arrived.';
}

export function summarizeCaptureSession({
  session,
  sampleCount,
  usableSampleCount,
  minTws,
  maxTws,
}: CaptureSessionAggregate): CaptureSessionSummary {
  const state = usableSampleCount > 0 ? 'good' : 'failed';
  const windRange =
    minTws === null || maxTws === null ? null : { min: minTws, max: maxTws };

  return {
    id: session.id,
    name: session.name,
    courseId: session.courseId,
    startedAt: session.startedAt,
    durationMs: Math.max(0, (session.endedAt ?? session.startedAt) - session.startedAt),
    sampleCount,
    state,
    windRange,
    windFrame: session.windFrame,
    warnsGroundWind: session.windFrame === 'ground',
    lowWindConfidence:
      maxTws !== null && maxTws < LOW_WIND_CONFIDENCE_KNOTS,
    failureExplanation:
      state === 'failed' ? failureExplanation(session.healthCounters) : null,
  };
}

export function summarizeCaptureSessions(
  aggregates: readonly CaptureSessionAggregate[],
): CaptureSessionSummary[] {
  return aggregates
    .map(summarizeCaptureSession)
    .sort((left, right) => right.startedAt - left.startedAt);
}
