import { CaptureRecordingStartError } from '../model/captureRecordingError';

export function captureFailureMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : 'Connection failed';

  if (error instanceof CaptureRecordingStartError && error.stage === 'preparing') {
    if (/allow recording notifications/i.test(detail)) {
      return 'SailPlan connected to the plotter, but Android blocked the recording notification required to start capture. Retry and allow the Android notification permission prompt.';
    }
    if (/foreground service is unavailable/i.test(detail)) {
      return 'SailPlan connected to the plotter, but this app build does not include the recording service. Install a current development build, then retry.';
    }
    return `SailPlan connected to the plotter, but could not prepare local recording. ${detail}`;
  }

  if (/timed out|timeout|no route|network is unreachable/i.test(detail)) {
    return 'SailPlan cannot reach the boat network. Connect to the boat Wi-Fi, then retry. On a fresh Android install, accept the system stay connected prompt.';
  }

  return `SailPlan reached Wi-Fi, but the plotter did not accept a connection at the saved address. ${detail}`;
}
