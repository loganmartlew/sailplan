import { CaptureRecordingStartError } from '../../model/captureRecordingError';
import { captureFailureMessage } from '../captureFailureMessage';

describe('captureFailureMessage', () => {
  it('identifies a notification permission failure after TCP connected', () => {
    expect(
      captureFailureMessage(
        new CaptureRecordingStartError(
          'preparing',
          new Error('Allow recording notifications to start capture'),
        ),
      ),
    ).toBe(
      'SailPlan connected to the plotter, but Android blocked the recording notification required to start capture. Retry and allow the Android notification permission prompt.',
    );
  });

  it('keeps a network timeout distinct from a connected setup failure', () => {
    expect(captureFailureMessage(new Error('Connection timed out'))).toBe(
      'SailPlan cannot reach the boat network. Connect to the boat Wi-Fi, then retry. On a fresh Android install, accept the system stay connected prompt.',
    );
  });

  it('explains an unrecognised failure after TCP connected', () => {
    expect(
      captureFailureMessage(
        new CaptureRecordingStartError(
          'preparing',
          new Error('Database unavailable'),
        ),
      ),
    ).toBe(
      'SailPlan connected to the plotter, but could not prepare local recording. Database unavailable',
    );
  });
});
