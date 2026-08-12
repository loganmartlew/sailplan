import type { CaptureSessionStatus } from './capture';

type ResumeCandidate = {
  status: CaptureSessionStatus;
  resumeDismissedAt: number | null;
};

export function isCaptureSessionResumable(
  session: ResumeCandidate,
  facts: { hasLaterSession: boolean; hasConfirmedData: boolean },
): boolean {
  return (
    session.status === 'autoEnded' &&
    session.resumeDismissedAt === null &&
    !facts.hasLaterSession &&
    !facts.hasConfirmedData
  );
}
