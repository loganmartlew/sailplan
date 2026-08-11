import { useEffect } from 'react';
import { View } from 'react-native';
import { Button, Text } from '~/components/ui';
import { CircleSmall } from '~/lib/icons';
import {
  endOrphanedCaptureSessions,
  useCaptureRecordingStore,
} from '../store/captureRecordingStore';

/**
 * The capture layer: app chrome sitting between screen content and the tab bar,
 * so a recording is visible and stoppable from every screen rather than only
 * the course plan it was started from. Renders nothing when not recording.
 *
 * Ticket `06` replaces this with the full strip — live TWS/TWA, the last sail
 * stamp and hold-to-stop. This is the `04`-sized version: status and Stop.
 */
export function CaptureRecordingBar() {
  const recording = useCaptureRecordingStore(s => s.recording);
  const isStopping = useCaptureRecordingStore(s => s.isStopping);
  const stop = useCaptureRecordingStore(s => s.stop);

  // The capture layer mounts once, app-wide, behind the migration gate — the
  // first point at which a session left `active` by a killed runtime can be
  // closed out.
  useEffect(() => {
    void endOrphanedCaptureSessions();
  }, []);

  if (!recording) return null;

  return (
    <View className='flex-row items-center gap-3 border-t border-border bg-card px-4 py-3'>
      <CircleSmall className='text-destructive' size={24} fill='currentColor' />
      <View className='flex-1'>
        <Text className='font-semibold'>Recording this course</Text>
        <Text className='text-sm text-muted-foreground'>
          NMEA log is being saved
        </Text>
      </View>
      <Button
        variant='destructive'
        size='sm'
        disabled={isStopping}
        onPress={() => void stop()}
      >
        <Text>{isStopping ? 'Stopping…' : 'Stop'}</Text>
      </Button>
    </View>
  );
}
