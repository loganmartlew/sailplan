import * as Notifications from 'expo-notifications';

export const CAPTURE_ENDED_CATEGORY = 'capture-auto-ended';
export const CAPTURE_RESUME_ACTION = 'capture-resume';
export const CAPTURE_DISMISS_ACTION = 'capture-dismiss';

type CaptureNotificationData = {
  captureSessionId: number;
  courseId: number;
};

export async function configureCaptureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationCategoryAsync(CAPTURE_ENDED_CATEGORY, [
    {
      identifier: CAPTURE_RESUME_ACTION,
      buttonTitle: 'Resume recording',
      options: { opensAppToForeground: true },
    },
    {
      identifier: CAPTURE_DISMISS_ACTION,
      buttonTitle: 'Dismiss',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
}

export async function postCaptureAutoEndedNotification(
  sessionId: number,
  courseId: number,
  gapMs: number,
): Promise<string> {
  const minutes = Math.round(gapMs / 60_000);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recording ended — plotter data lost',
      body: `No valid plotter data for ${minutes} minutes`,
      channelId: 'capture-recording',
      categoryIdentifier: CAPTURE_ENDED_CATEGORY,
      data: { captureSessionId: sessionId, courseId } satisfies CaptureNotificationData,
      sound: false,
      vibrate: [],
    },
    trigger: null,
  });
}

export function captureNotificationData(
  response: Notifications.NotificationResponse,
): CaptureNotificationData | null {
  const data = response.notification.request.content.data;
  return data &&
    typeof data.captureSessionId === 'number' &&
    typeof data.courseId === 'number'
    ? { captureSessionId: data.captureSessionId, courseId: data.courseId }
    : null;
}

export async function dismissCaptureNotification(
  notificationId: string,
): Promise<void> {
  await Notifications.dismissNotificationAsync(notificationId);
}

export async function dismissNotificationsForCapture(sessionId: number): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presented
      .filter(item => item.request.content.data?.captureSessionId === sessionId)
      .map(item => Notifications.dismissNotificationAsync(item.request.identifier)),
  );
}
