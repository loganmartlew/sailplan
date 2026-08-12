import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '~/components/ui';
import { CircleSmall } from '~/lib/icons';
import {
  endOrphanedCaptureSessions,
  useCaptureRecordingStore,
} from '../store/captureRecordingStore';
import { formatCaptureDuration } from '../util/formatCaptureDuration';
// Throwaway, ticket `07`.
import { recordCaptureTimerTick } from '../util/captureDiagnostics';

/**
 * The capture layer: app chrome floating over screen content just above the tab
 * bar, so a recording is visible and stoppable from every screen rather than
 * only the course plan it was started from. Renders nothing when not recording.
 *
 * Ticket `06` replaces this with the full pill — live TWS/TWA, the last sail
 * stamp and hold-to-stop. This is the `04`-sized version: status and Stop.
 */
export function CaptureRecordingBar() {
  const recording = useCaptureRecordingStore(s => s.recording);
  const isStopping = useCaptureRecordingStore(s => s.isStopping);
  const stop = useCaptureRecordingStore(s => s.stop);
  const [now, setNow] = useState(Date.now);

  // The capture layer mounts once, app-wide, behind the migration gate — the
  // first point at which a session left `active` by a killed runtime can be
  // closed out.
  useEffect(() => {
    void endOrphanedCaptureSessions();
  }, []);

  useEffect(() => {
    if (!recording) return;

    setNow(Date.now());
    const timer = setInterval(() => {
      // Throwaway, ticket `07`: this interval is a JS timer, which
      // `JavaTimerManager` stalls while backgrounded. If a backlog of ticks
      // lands with the socket burst on resume, both are on the blocked main
      // thread and the diagnostic trace shows them together.
      recordCaptureTimerTick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  if (!recording) return null;

  return (
    <View className='absolute bottom-full left-3 right-3 z-20 mb-2 flex-row items-center gap-3 rounded-full border border-border bg-card px-4 py-3 shadow-lg shadow-foreground/20'>
      <CircleSmall className='text-destructive' size={24} fill='currentColor' />
      <View className='flex-1'>
        <Text className='font-semibold'>Recording NMEA logs</Text>
        <Text className='font-mono text-sm text-muted-foreground'>
          {formatCaptureDuration(now - recording.startedAt)}
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
