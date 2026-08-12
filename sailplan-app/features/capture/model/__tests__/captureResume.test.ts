import { isCaptureSessionResumable } from '../captureResume';

const autoEnded = {
  status: 'autoEnded' as const,
  resumeDismissedAt: null,
};

describe('capture resumability', () => {
  it('offers only an undismissed auto-ended session with no later recording or confirmation', () => {
    expect(
      isCaptureSessionResumable(autoEnded, {
        hasLaterSession: false,
        hasConfirmedData: false,
      }),
    ).toBe(true);
  });

  it.each([
    [{ ...autoEnded, status: 'ended' as const }, false, false],
    [{ ...autoEnded, status: 'active' as const }, false, false],
    [{ ...autoEnded, resumeDismissedAt: 123 }, false, false],
    [autoEnded, true, false],
    [autoEnded, false, true],
  ])('rejects an ineligible session', (session, hasLaterSession, hasConfirmedData) => {
    expect(
      isCaptureSessionResumable(session, { hasLaterSession, hasConfirmedData }),
    ).toBe(false);
  });
});
