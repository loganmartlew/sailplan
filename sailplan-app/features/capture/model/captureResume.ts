import type { CaptureSessionStatus } from './capture';

type ResumeCandidate = {
  status: CaptureSessionStatus;
  resumeDismissedAt: number | null;
};

/**
 * Whether a session holds hand work a resumed recording would destroy.
 *
 * Resuming re-detects the session's legs, and `redetectCaptureReview` deletes
 * every stored span to do it. `reviewedAt` is the only record that the sailor
 * drew any of those spans themselves, so this is the door that keeps a resume
 * from silently erasing an afternoon of review.
 */
export function hasReviewedData(
  legs: readonly { reviewedAt: number | null }[],
): boolean {
  return legs.some(leg => leg.reviewedAt !== null);
}

export function isCaptureSessionResumable(
  session: ResumeCandidate,
  facts: { hasLaterSession: boolean; hasReviewedData: boolean },
): boolean {
  return (
    session.status === 'autoEnded' &&
    session.resumeDismissedAt === null &&
    !facts.hasLaterSession &&
    !facts.hasReviewedData
  );
}
