import { buildReviewTrack } from '../reviewTrack';

const sample = (
  timestamp: number,
  lat: number | null = -36.8 + timestamp / 1_000_000,
  lon: number | null = 174.7 + timestamp / 1_000_000,
) => ({ timestamp, lat, lon });

describe('buildReviewTrack', () => {
  it('draws each attribution span in its supplied colour', () => {
    const track = buildReviewTrack({
      samples: [sample(0), sample(1_000), sample(2_000), sample(3_000)],
      spans: [
        { startTime: 0, endTime: 2_000, color: '#ef4444' },
        { startTime: 2_000, endTime: 4_000, color: '#3b82f6' },
      ],
    });

    expect(track.map(segment => ({ color: segment.color, points: segment.coordinates.length })))
      .toEqual([
        { color: '#ef4444', points: 3 },
        { color: '#3b82f6', points: 2 },
      ]);
    expect(track[0].coordinates.at(-1)).toEqual(track[1].coordinates[0]);
  });

  it('keeps a one-fix span visible between adjacent span colours', () => {
    const track = buildReviewTrack({
      samples: [sample(0), sample(1_000), sample(2_000), sample(3_000)],
      spans: [
        { startTime: 0, endTime: 1_000, color: '#ef4444' },
        { startTime: 1_000, endTime: 2_000, color: '#22c55e' },
        { startTime: 2_000, endTime: 4_000, color: '#3b82f6' },
      ],
    });

    expect(track.map(segment => segment.color))
      .toEqual(['#ef4444', '#22c55e', '#3b82f6']);
    expect(track[1].coordinates.map(point => point.timestamp)).toEqual([1_000, 2_000]);
  });

  it('never joins coordinates across a TTL-null fix or a gap over five seconds', () => {
    const track = buildReviewTrack({
      samples: [
        sample(0),
        sample(1_000),
        sample(2_000, null, null),
        sample(3_000),
        sample(4_000),
        sample(10_000),
        sample(11_000),
      ],
      spans: [{ startTime: 0, endTime: 12_000, color: '#ef4444' }],
    });

    expect(track.map(segment => segment.coordinates.map(point => point.timestamp)))
      .toEqual([[0, 1_000], [3_000, 4_000], [10_000, 11_000]]);
  });

  it('uses a neutral track for GPS fixes outside attribution spans', () => {
    const track = buildReviewTrack({
      samples: [sample(0), sample(1_000)],
      spans: [],
      fallbackColor: '#64748b',
    });

    expect(track).toHaveLength(1);
    expect(track[0].color).toBe('#64748b');
  });
});
