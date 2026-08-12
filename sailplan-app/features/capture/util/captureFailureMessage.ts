import {
  CaptureRecordingStartError,
  type CaptureStartReason,
} from '../model/captureRecordingError';

const MESSAGES: Record<CaptureStartReason, string> = {
  unreachable:
    'SailPlan cannot reach the boat network. Connect to the boat Wi-Fi, then retry. On a fresh Android install, accept the system stay connected prompt.',
  refused:
    'SailPlan reached Wi-Fi, but the plotter did not accept a connection at the saved address. Check the plotter is on and the address in plotter setup.',
  'service-unavailable':
    'SailPlan connected to the plotter, but could not start the recording service. Restart the app, then retry.',
  storage:
    'SailPlan connected to the plotter, but could not prepare local recording.',
};

/**
 * An unclassified error is exactly the case where SailPlan does *not* know
 * whether the plotter, the network or its own storage is at fault, so the
 * fallback says nothing it cannot support. Defaulting to the `refused` copy
 * would send a sailor to re-check an address that was never the problem — the
 * same misdiagnosis the `ETIMEDOUT` fix was written to eliminate.
 */
const UNKNOWN_MESSAGE =
  'SailPlan could not start recording. Retry, and check the boat Wi-Fi and plotter setup if it keeps failing.';

export function captureFailureMessage(error: unknown): string {
  if (error instanceof CaptureRecordingStartError) {
    return MESSAGES[error.reason];
  }
  return UNKNOWN_MESSAGE;
}
