import {
  formatCaptureNotification,
  formatCaptureValue,
  formatSailStampAge,
  isSailStampStale,
  captureStopSessionId,
  formatConnectionGapAge,
} from '../captureLayerState';

describe('capture layer state', () => {
  it.each([
    [null, '—'],
    [12.34, '12.3'],
    [-87.6, '-88°'],
  ])('formats %s as a glanceable live value', (value, expected) => {
    expect(formatCaptureValue(value, expected.endsWith('°') ? 'angle' : 'speed')).toBe(
      expected,
    );
  });

  it.each([
    [0, 'just now'],
    [59_999, 'just now'],
    [60_000, '1 min ago'],
    [14 * 60_000, '14 min ago'],
    [60 * 60_000, '1 hr ago'],
    [2 * 60 * 60_000, '2 hr ago'],
  ])('formats a stamp age of %i ms as history', (age, expected) => {
    expect(formatSailStampAge(1_000_000, 1_000_000 + age)).toBe(expected);
  });

  it('turns stale only after fifteen minutes', () => {
    expect(isSailStampStale(1_000_000, 1_000_000 + 15 * 60_000)).toBe(false);
    expect(isSailStampStale(1_000_000, 1_000_000 + 15 * 60_000 + 1)).toBe(true);
  });

  it('builds the live foreground notification without implying a current sail', () => {
    expect(
      formatCaptureNotification(
        { tws: 12.34, twa: -87.6, sampleCount: 1_234, lastSampleAt: 0 },
        1_000_000 - 4 * 60_000,
        1_000_000,
      ),
    ).toEqual({
      title: 'TWS 12.3 kn  •  TWA -88°',
      description: '1,234 samples  •  Last stamp 4 min ago',
    });
  });

  it('shows connection loss instead of stale live values in the notification', () => {
    expect(
      formatCaptureNotification(
        { tws: 12.3, twa: -88, sampleCount: 12, lastSampleAt: 100 },
        null,
        65_000,
        { status: 'retrying', gapStartedAt: 1_000 },
      ),
    ).toEqual({
      title: 'Connection lost — retrying',
      description: 'Gap 1 min 4 sec  •  12 samples',
    });
  });

  it.each([
    [0, '0 sec'],
    [59_999, '59 sec'],
    [60_000, '1 min'],
    [64_999, '1 min 4 sec'],
  ])('formats a connection gap age of %i ms', (age, expected) => {
    expect(formatConnectionGapAge(age)).toBe(expected);
  });

  it('binds the explicit notification stop action to its capture session', () => {
    expect(
      captureStopSessionId(
        'sailplan://?captureSessionId=42&stopCapture=true',
      ),
    ).toBe(42);
    expect(captureStopSessionId('sailplan://?captureSessionId=42')).toBeNull();
    expect(captureStopSessionId('sailplan://?stopCapture=true')).toBeNull();
    expect(captureStopSessionId('sailplan://?stopCapture=false')).toBeNull();
  });
});
