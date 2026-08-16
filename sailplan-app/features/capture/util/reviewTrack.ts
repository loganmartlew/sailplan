export const REVIEW_TRACK_GAP_MS = 5_000;
export const REVIEW_TRACK_FALLBACK_COLOR = '#64748b';

export interface ReviewTrackSample {
  timestamp: number;
  lat: number | null;
  lon: number | null;
}

export interface ReviewTrackSpan {
  startTime: number;
  endTime: number;
  color: string;
}

export interface ReviewTrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface ReviewTrackSegment {
  color: string;
  coordinates: ReviewTrackPoint[];
}

export function buildReviewTrack({
  samples,
  spans,
  fallbackColor = REVIEW_TRACK_FALLBACK_COLOR,
}: {
  samples: readonly ReviewTrackSample[];
  spans: readonly ReviewTrackSpan[];
  fallbackColor?: string;
}): ReviewTrackSegment[] {
  const orderedSpans = [...spans].sort((a, b) => a.startTime - b.startTime);
  const segments: ReviewTrackSegment[] = [];
  let current: ReviewTrackSegment | null = null;
  let previousTimestamp: number | null = null;
  let spanIndex = 0;

  const flush = () => {
    if (current && current.coordinates.length >= 2) segments.push(current);
    current = null;
  };

  for (const sample of samples) {
    while (
      spanIndex < orderedSpans.length &&
      sample.timestamp >= orderedSpans[spanIndex].endTime
    ) {
      spanIndex += 1;
    }
    const span = orderedSpans[spanIndex];
    const color = span &&
      sample.timestamp >= span.startTime &&
      sample.timestamp < span.endTime
      ? span.color
      : fallbackColor;
    const hasFix = sample.lat !== null && sample.lon !== null;
    const crossesGap = previousTimestamp !== null &&
      sample.timestamp - previousTimestamp > REVIEW_TRACK_GAP_MS;

    if (!hasFix) {
      flush();
      previousTimestamp = null;
      continue;
    }
    const point = {
      latitude: sample.lat!,
      longitude: sample.lon!,
      timestamp: sample.timestamp,
    };
    if (crossesGap) {
      flush();
    } else if (current && current.color !== color) {
      // Both coloured lines meet at the first fix in the new span. Sharing the
      // point preserves the continuous GPS track without drawing through a
      // real data gap, and keeps even a one-fix span visible.
      current.coordinates.push(point);
      flush();
    }
    current ??= { color, coordinates: [] };
    current.coordinates.push(point);
    previousTimestamp = sample.timestamp;
  }
  flush();
  return segments;
}
