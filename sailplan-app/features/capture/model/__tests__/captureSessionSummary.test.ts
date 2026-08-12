import type { CaptureSession } from '../capture';
import {
  summarizeCaptureSession,
  summarizeCaptureSessions,
} from '../captureSessionSummary';

function session(overrides: Partial<CaptureSession> = {}): CaptureSession {
  return {
    id: 1,
    boatProfileId: 2,
    name: 'Wednesday race',
    courseId: null,
    startedAt: Date.UTC(2026, 7, 12, 1),
    endedAt: Date.UTC(2026, 7, 12, 3),
    status: 'ended',
    resumeDismissedAt: null,
    rawLogPath: null,
    windFrame: 'water',
    healthCounters: '{}',
    notes: '',
    ...overrides,
  };
}

describe('capture session summaries', () => {
  it('describes a usable session without storing derived confidence', () => {
    const summary = summarizeCaptureSession({
      session: session({ windFrame: 'ground' }),
      sampleCount: 5_800,
      usableSampleCount: 5_700,
      minTws: 4.2,
      maxTws: 5.9,
    });

    expect(summary).toMatchObject({
      state: 'good',
      durationMs: 2 * 60 * 60_000,
      sampleCount: 5_800,
      windRange: { min: 4.2, max: 5.9 },
      windFrame: 'ground',
      warnsGroundWind: true,
      lowWindConfidence: true,
    });
    expect(session()).not.toHaveProperty('lowWindConfidence');
  });

  it('does not flag a wind range that reaches the shear threshold', () => {
    const summary = summarizeCaptureSession({
      session: session(),
      sampleCount: 10,
      usableSampleCount: 10,
      minTws: 5.5,
      maxTws: 6,
    });

    expect(summary.lowWindConfidence).toBe(false);
  });

  it('explains rejected wind sentences when no sample is usable', () => {
    const summary = summarizeCaptureSession({
      session: session({
        healthCounters: JSON.stringify({
          overLengthLines: 0,
          rejects: { MWV: 18, VHW: 2 },
          stale: { tws: 9 },
        }),
      }),
      sampleCount: 0,
      usableSampleCount: 0,
      minTws: null,
      maxTws: null,
    });

    expect(summary.state).toBe('failed');
    expect(summary.failureExplanation).toContain('18 MWV');
    expect(summary.failureExplanation).toContain('invalid');
    expect(summary.failureExplanation).toContain('TWS (9)');
    expect(summary.failureExplanation).toContain('stopped arriving');
  });

  it('explains stale fields when samples contain no usable polar data', () => {
    const summary = summarizeCaptureSession({
      session: session({
        healthCounters: JSON.stringify({
          overLengthLines: 0,
          rejects: {},
          stale: { tws: 42, twa: 41, stw: 8 },
        }),
      }),
      sampleCount: 50,
      usableSampleCount: 0,
      minTws: null,
      maxTws: null,
    });

    expect(summary.state).toBe('failed');
    expect(summary.failureExplanation).toContain('TWS (42)');
    expect(summary.failureExplanation).toContain('TWA (41)');
    expect(summary.failureExplanation).toContain('stopped arriving');
  });

  it('falls back to a network/feed explanation for missing diagnostics', () => {
    const summary = summarizeCaptureSession({
      session: session({ healthCounters: 'not-json' }),
      sampleCount: 0,
      usableSampleCount: 0,
      minTws: null,
      maxTws: null,
    });

    expect(summary.failureExplanation).toContain('no complete instrument samples');
    expect(summary.failureExplanation).toContain('connection or instrument feed');
  });

  it('orders dozens of sessions newest first', () => {
    const summaries = summarizeCaptureSessions(
      Array.from({ length: 40 }, (_, index) => ({
        session: session({ id: index + 1, startedAt: index * 1_000 }),
        sampleCount: 1,
        usableSampleCount: 1,
        minTws: 8,
        maxTws: 9,
      })),
    );

    expect(summaries).toHaveLength(40);
    expect(summaries[0].id).toBe(40);
    expect(summaries[39].id).toBe(1);
  });
});
