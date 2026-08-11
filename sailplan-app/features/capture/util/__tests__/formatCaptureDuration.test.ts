import { formatCaptureDuration } from '../formatCaptureDuration';

describe('formatCaptureDuration', () => {
  it.each([
    [0, '00:00'],
    [999, '00:00'],
    [1_000, '00:01'],
    [61_000, '01:01'],
    [3_661_000, '1:01:01'],
  ])('formats %i milliseconds as %s', (durationMs, expected) => {
    expect(formatCaptureDuration(durationMs)).toBe(expected);
  });

  it('clamps clock skew before the session start to zero', () => {
    expect(formatCaptureDuration(-1_000)).toBe('00:00');
  });
});
