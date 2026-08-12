import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Button, H3, Text } from '~/components/ui';
import { useSails, type Sail } from '~/features/sail';
import { CircleSmall, Plus } from '~/lib/icons';
import { cn } from '~/lib/utils';
import { createSailStamp, deleteSailStamp } from '../api/sailStamp';
import {
  formatCaptureValue,
  formatConnectionGapAge,
  formatSailStampAge,
  isSailStampStale,
} from '../model/captureLayerState';
import {
  endOrphanedCaptureSessions,
  useCaptureRecordingStore,
  type CaptureStampHistory,
} from '../store/captureRecordingStore';
// Throwaway, ticket `07`.
import { recordCaptureTimerTick } from '../util/captureDiagnostics';

const UNDO_WINDOW_MS = 9_000;
const HOLD_TO_STOP_MS = 900;

type UndoStamp = {
  stamp: CaptureStampHistory;
  previous: CaptureStampHistory | null;
};

function SailStampSheet({
  open,
  sails,
  isStamping,
  onClose,
  onStamp,
}: {
  open: boolean;
  sails: Sail[];
  isStamping: boolean;
  onClose: () => void;
  onStamp: (sail: Sail) => void;
}) {
  const stopPropagation = (event: GestureResponderEvent) =>
    event.stopPropagation();

  return (
    <Modal
      visible={open}
      transparent
      animationType='slide'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className='flex-1 justify-end bg-black/60'
        onPress={onClose}
        accessibilityRole='button'
        accessibilityLabel='Close sail picker'
      >
        <Pressable
          className='max-h-[72%] rounded-t-3xl bg-background px-4 pb-5 pt-4'
          onPress={stopPropagation}
        >
          <View className='mb-4 items-center gap-3'>
            <View className='h-1.5 w-12 rounded-full bg-muted' />
            <H3 className='pb-0'>Stamp the sail that is up</H3>
            <Text className='text-center text-sm text-muted-foreground'>
              This records one instant only. It does not stay in force.
            </Text>
          </View>
          <FlatList
            data={sails}
            numColumns={2}
            keyExtractor={sail => String(sail.id)}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            showsVerticalScrollIndicator
            renderItem={({ item }) => (
              <Pressable
                className='h-24 flex-1 overflow-hidden rounded-2xl border border-border active:opacity-80'
                style={{ backgroundColor: item.color.toLowerCase() || '#888' }}
                disabled={isStamping}
                onPress={() => onStamp(item)}
                accessibilityRole='button'
                accessibilityLabel={`Stamp ${item.name}`}
              >
                <View className='flex-1 items-center justify-center bg-black/25 px-2'>
                  <Text className='text-center text-xl font-bold text-white'>
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className='py-8 text-center text-muted-foreground'>
                Add a sail before recording stamps.
              </Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** App-wide recording chrome. It deliberately renders nothing while idle. */
export function CaptureRecordingBar() {
  const recording = useCaptureRecordingStore(state => state.recording);
  const live = useCaptureRecordingStore(state => state.live);
  const connection = useCaptureRecordingStore(state => state.connection);
  const lastStamp = useCaptureRecordingStore(state => state.lastStamp);
  const setLastStamp = useCaptureRecordingStore(state => state.setLastStamp);
  const isStopping = useCaptureRecordingStore(state => state.isStopping);
  const stop = useCaptureRecordingStore(state => state.stop);
  const sailsQuery = useSails();
  const [now, setNow] = useState(Date.now);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isStamping, setIsStamping] = useState(false);
  const [undoStamp, setUndoStamp] = useState<UndoStamp | null>(null);
  const heldToStop = useRef(false);

  useEffect(() => {
    void endOrphanedCaptureSessions();
  }, []);

  useEffect(() => {
    if (!recording) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      // Throwaway, ticket `07`; see captureDiagnostics.ts.
      recordCaptureTimerTick();
      setNow(Date.now());
    }, 1_000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!undoStamp) return;
    const timer = setTimeout(() => setUndoStamp(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [undoStamp]);

  if (!recording) return null;

  const stampSail = async (sail: Sail) => {
    if (isStamping) return;
    setIsStamping(true);
    try {
      const previous = lastStamp;
      const row = await createSailStamp(recording.sessionId, sail.id);
      const history: CaptureStampHistory = {
        id: row.id,
        sailId: sail.id,
        sailName: sail.name,
        sailColor: sail.color,
        timestamp: row.timestamp,
      };
      setLastStamp(history);
      setUndoStamp({ stamp: history, previous });
      setSheetOpen(false);
      setNow(Date.now());
    } finally {
      setIsStamping(false);
    }
  };

  const undo = async () => {
    if (!undoStamp) return;
    await deleteSailStamp(undoStamp.stamp.id);
    if (lastStamp?.id === undoStamp.stamp.id) {
      setLastStamp(undoStamp.previous);
    }
    setUndoStamp(null);
  };

  const openSheet = () => {
    if (heldToStop.current) {
      heldToStop.current = false;
      return;
    }
    setSheetOpen(true);
  };

  const holdToStop = () => {
    heldToStop.current = true;
    setTimeout(() => {
      heldToStop.current = false;
    }, 1_500);
    setSheetOpen(false);
    void stop();
  };

  const stale = lastStamp
    ? isSailStampStale(lastStamp.timestamp, now)
    : false;

  return (
    <>
      {connection.status === 'retrying' && (
        <View
          className='absolute bottom-full left-5 right-5 z-20 mb-16 flex-row items-center justify-center rounded-full bg-amber-500 px-3 py-1.5'
          accessibilityRole='alert'
          accessibilityLabel={`Retrying plotter connection. Gap ${formatConnectionGapAge(now - connection.gapStartedAt)}`}
        >
          <Text className='text-sm font-semibold text-black'>
            Retrying · Gap {formatConnectionGapAge(now - connection.gapStartedAt)}
          </Text>
        </View>
      )}
      <Pressable
        className='absolute bottom-full left-3 right-3 z-20 mb-2 flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg shadow-foreground/20 active:opacity-90'
        disabled={isStopping}
        onPress={openSheet}
        onLongPress={holdToStop}
        delayLongPress={HOLD_TO_STOP_MS}
        accessibilityRole='button'
        accessibilityLabel='Open sail stamp picker'
        accessibilityHint='Hold to stop recording'
      >
        <CircleSmall
          className={cn(
            'text-green-500',
            connection.status === 'retrying' && 'text-amber-500',
          )}
          size={18}
          fill='currentColor'
        />
        <View className='items-center'>
          <Text className='text-[10px] uppercase text-muted-foreground'>TWS</Text>
          <Text
            className={cn(
              'font-mono text-xl font-bold leading-6',
              connection.status === 'retrying' && 'text-muted-foreground',
            )}
          >
            {formatCaptureValue(live.tws, 'speed')}
          </Text>
        </View>
        <View className='items-center'>
          <Text className='text-[10px] uppercase text-muted-foreground'>TWA</Text>
          <Text
            className={cn(
              'font-mono text-xl font-bold leading-6',
              connection.status === 'retrying' && 'text-muted-foreground',
            )}
          >
            {formatCaptureValue(live.twa, 'angle')}
          </Text>
        </View>
        <View className='min-w-0 flex-1 border-l border-border pl-2'>
          <Text className='text-[10px] uppercase text-muted-foreground'>
            Stamp history
          </Text>
          <View className='flex-row items-center gap-1.5'>
            {lastStamp && (
              <View
                className='h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: lastStamp.sailColor }}
              />
            )}
            <Text
              numberOfLines={1}
              className={cn(
                'min-w-0 text-xs text-muted-foreground',
                stale && 'text-amber-500',
              )}
            >
              {lastStamp
                ? `${lastStamp.sailName} · ${formatSailStampAge(lastStamp.timestamp, now)}`
                : 'No stamp yet'}
            </Text>
          </View>
        </View>
        <View className='h-9 w-9 items-center justify-center rounded-full bg-primary'>
          <Plus className='text-primary-foreground' size={22} />
        </View>
      </Pressable>

      {undoStamp && (
        <View className='absolute bottom-full left-5 right-5 z-30 mb-20 flex-row items-center rounded-2xl bg-foreground px-4 py-2 shadow-lg'>
          <Text className='flex-1 text-sm text-background'>
            Stamped {undoStamp.stamp.sailName}
          </Text>
          <Button variant='ghost' size='sm' onPress={() => void undo()}>
            <Text className='font-semibold text-primary'>Undo</Text>
          </Button>
        </View>
      )}

      <SailStampSheet
        open={sheetOpen}
        sails={sailsQuery?.data ?? []}
        isStamping={isStamping}
        onClose={() => setSheetOpen(false)}
        onStamp={sail => void stampSail(sail)}
      />
    </>
  );
}
