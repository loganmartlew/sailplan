import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '~/components/ui';
import { stopActiveCaptureRecording } from '~/features/capture/util/captureRecordingManager';

/** Notification-only Stop action. The service's PendingIntent opens this route. */
export default function CaptureNotificationStop() {
  useEffect(() => {
    void stopActiveCaptureRecording();
  }, []);

  return (
    <View className='flex-1 items-center justify-center gap-3 p-6'>
      <ActivityIndicator />
      <Text>Stopping recording…</Text>
    </View>
  );
}
