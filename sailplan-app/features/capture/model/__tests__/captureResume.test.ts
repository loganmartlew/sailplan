import { hasReviewedData, isCaptureSessionResumable } from '../captureResume';

const autoEnded = {
  status: 'autoEnded' as const,
  resumeDismissedAt: null,
};

describe('capture resumability', () => {
  it('offers only an undismissed auto-ended session with no later recording or review', () => {
    expect(
      isCaptureSessionResumable(autoEnded, {
        hasLaterSession: false,
        hasReviewedData: false,
      }),
    ).toBe(true);
  });

  it.each([
    [{ ...autoEnded, status: 'ended' as const }, false, false],
    [{ ...autoEnded, status: 'active' as const }, false, false],
    [{ ...autoEnded, resumeDismissedAt: 123 }, false, false],
    [autoEnded, true, false],
    [autoEnded, false, true],
  ])('rejects an ineligible session', (session, hasLaterSession, reviewed) => {
    expect(
      isCaptureSessionResumable(session, {
        hasLaterSession,
        hasReviewedData: reviewed,
      }),
    ).toBe(false);
  });
});

// The one genuinely destructive edge in ticket 25: resuming re-detects, and
// re-detection deletes every stored span. A session the sailor has hand-edited
// must not be offered, and must not be resumable if the id is asked for
// directly.
describe('an auto-ended session with a reviewed leg', () => {
  it('is not resumable', () => {
    const legs = [{ reviewedAt: null }, { reviewedAt: 1_700_000_000_000 }];

    expect(hasReviewedData(legs)).toBe(true);
    expect(
      isCaptureSessionResumable(autoEnded, {
        hasLaterSession: false,
        hasReviewedData: hasReviewedData(legs),
      }),
    ).toBe(false);
  });

  it('is resumable while every leg is still an untouched draft', () => {
    const legs = [{ reviewedAt: null }, { reviewedAt: null }];

    expect(hasReviewedData(legs)).toBe(false);
    expect(
      isCaptureSessionResumable(autoEnded, {
        hasLaterSession: false,
        hasReviewedData: hasReviewedData(legs),
      }),
    ).toBe(true);
  });

  it('has nothing to lose when no legs have been materialised at all', () => {
    expect(hasReviewedData([])).toBe(false);
  });
});
