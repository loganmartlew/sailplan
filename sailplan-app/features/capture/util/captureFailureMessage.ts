import {
  CaptureRecordingStartError,
  type CaptureStartReason,
} from '../model/captureRecordingError';

const MESSAGES: Record<CaptureStartReason, string> = {
  unreachable:
    'SailPlan cannot reach the boat network. Connect to the boat Wi-Fi, then retry. On a fresh Android install, accept the system stay connected prompt.',
  refused:
    'SailPlan reached Wi-Fi, but the plotter did not accept a connection at the saved address. Check the plotter is on and the address in plotter setup.',
  'notification-permission-denied':
    'SailPlan connected to the plotter, but Android blocked the recording notification required to start capture. Retry and allow the Android notification permission prompt.',
  'service-unavailable':
    'SailPlan connected to the plotter, but could not start the recording service. Restart the app, then retry.',
  storage:
    'SailPlan connected to the plotter, but could not prepare local recording.',
};

export function captureFailureMessage(error: unknown): string {
  if (error instanceof CaptureRecordingStartError) {
    return MESSAGES[error.reason];
  }
  return MESSAGES.refused;
}
