jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'notification-42'),
  dismissNotificationAsync: jest.fn(async () => undefined),
  getPresentedNotificationsAsync: jest.fn(async () => []),
}));

import * as Notifications from 'expo-notifications';
import {
  CAPTURE_DISMISS_ACTION,
  CAPTURE_ENDED_CATEGORY,
  CAPTURE_RESUME_ACTION,
  configureCaptureNotifications,
  postCaptureAutoEndedNotification,
} from '../captureNotifications';

describe('capture auto-end notification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers only Resume recording and Dismiss', async () => {
    await configureCaptureNotifications();

    expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
      CAPTURE_ENDED_CATEGORY,
      [
        expect.objectContaining({
          identifier: CAPTURE_RESUME_ACTION,
          buttonTitle: 'Resume recording',
        }),
        expect.objectContaining({
          identifier: CAPTURE_DISMISS_ACTION,
          buttonTitle: 'Dismiss',
        }),
      ],
    );
  });

  it('posts the durable resume coordinates after thirty minutes of loss', async () => {
    await expect(
      postCaptureAutoEndedNotification(42, 9, 30 * 60_000),
    ).resolves.toBe('notification-42');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: 'Recording ended — plotter data lost',
        body: 'No valid plotter data for 30 minutes',
        categoryIdentifier: CAPTURE_ENDED_CATEGORY,
        data: { captureSessionId: 42, courseId: 9 },
      }),
      trigger: null,
    });
  });
});
