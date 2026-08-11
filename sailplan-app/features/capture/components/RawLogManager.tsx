import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, CardContent, H3, Muted, Text } from '~/components/ui';
import { useAlert } from '~/hooks/useAlert';
import { useConfirm } from '~/hooks/useConfirm';
import { Check, Share2, Trash, X } from '~/lib/icons';
import {
  formatRawLogBytes,
  getRawLogStorageBytes,
} from '../model/rawLogManager';
import { useRawLogManager } from '../hooks/useRawLogManager';
import { removeRawLog, shareRawLog } from '../api/rawLogs';

export function RawLogManager() {
  const alert = useAlert();
  const confirm = useConfirm();
  const { entries, isLoading, rawLogBytes, refresh } = useRawLogManager();
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  const selectedRawLogs = useMemo(
    () =>
      entries
        .flatMap(entry =>
          entry.rawLog &&
          (entry.kind === 'unlinked' || entry.session.status !== 'active')
            ? [entry.rawLog]
            : [],
        )
        .filter(rawLog => selectedPaths.includes(rawLog.path)),
    [entries, selectedPaths],
  );
  const reclaimedBytes = getRawLogStorageBytes(selectedRawLogs);

  function toggleSelection(path: string) {
    setSelectedPaths(paths =>
      paths.includes(path)
        ? paths.filter(selectedPath => selectedPath !== path)
        : [...paths, path],
    );
  }

  async function onDeleteSelected() {
    if (selectedRawLogs.length === 0) return;

    const proceed = await confirm({
      title: 'Delete raw logs?',
      message: `Delete ${selectedRawLogs.length} ${selectedRawLogs.length === 1 ? 'raw log' : 'raw logs'} and reclaim ${formatRawLogBytes(reclaimedBytes)}? Recordings, samples, stamps, legs, spans, and promoted polars will be kept.`,
      confirmText: 'Delete logs',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!proceed) return;

    const results = selectedRawLogs.map(rawLog => {
      try {
        removeRawLog(rawLog.path);
        return true;
      } catch (error) {
        console.error('Could not delete raw log:', error);
        return false;
      }
    });

    setSelectedPaths([]);
    refresh();

    const failures = results.filter(result => !result).length;
    if (failures > 0) {
      await alert({
        title: 'Some logs were kept',
        message: `${failures} ${failures === 1 ? 'raw log could' : 'raw logs could'} not be deleted. Try again from this list.`,
        confirmText: 'OK',
      });
    }
  }

  async function onShare(path: string) {
    try {
      await shareRawLog(path);
    } catch (error) {
      console.error('Could not share raw log:', error);
      await alert({
        title: 'Export unavailable',
        message: 'This raw NMEA log could not be shared.',
        confirmText: 'OK',
      });
    }
  }

  async function onRetryDelete(path: string) {
    try {
      removeRawLog(path);
      refresh();
    } catch (error) {
      console.error('Could not delete unlinked raw log:', error);
      await alert({
        title: 'Unlinked log kept',
        message: 'The raw log could not be deleted. Try again later.',
        confirmText: 'OK',
      });
    }
  }

  return (
    <View className='gap-4'>
      <Card>
        <CardContent className='gap-1 py-5'>
          <Text className='text-2xl font-semibold'>
            {formatRawLogBytes(rawLogBytes)}
          </Text>
          <Muted>Raw NMEA storage in use</Muted>
          <Muted className='pt-2 text-xs'>
            Raw logs are optional evidence. Deleting one never deletes its
            recording or polar data.
          </Muted>
        </CardContent>
      </Card>

      <View className='gap-1'>
        <H3>Raw logs</H3>
        <Muted>
          Oldest first. Select logs to preview the space you will reclaim.
        </Muted>
      </View>

      {isLoading ? (
        <Card>
          <CardContent className='py-5'>
            <Muted>Checking raw logs…</Muted>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className='py-5'>
            <Muted>No raw NMEA logs are stored on this device.</Muted>
          </CardContent>
        </Card>
      ) : (
        entries.map(entry => (
          <RawLogRow
            key={entry.id}
            entry={entry}
            selected={
              entry.rawLog ? selectedPaths.includes(entry.rawLog.path) : false
            }
            onToggleSelection={toggleSelection}
            onShare={onShare}
            onRetryDelete={onRetryDelete}
          />
        ))
      )}

      {selectedRawLogs.length > 0 && (
        <Card className='border-destructive'>
          <CardContent className='gap-3 py-4'>
            <View>
              <Text className='font-medium'>
                {selectedRawLogs.length} selected ·{' '}
                {formatRawLogBytes(reclaimedBytes)} reclaimed
              </Text>
              <Muted className='text-xs'>
                Only the selected raw logs will be deleted.
              </Muted>
            </View>
            <View className='flex-row gap-2'>
              <Button
                className='flex-1'
                variant='outline'
                onPress={() => setSelectedPaths([])}
              >
                <X size={16} />
                <Text>Clear</Text>
              </Button>
              <Button
                className='flex-1'
                variant='destructive'
                onPress={onDeleteSelected}
              >
                <Trash size={16} />
                <Text>Delete logs</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );
}

interface RawLogRowProps {
  entry: ReturnType<typeof useRawLogManager>['entries'][number];
  selected: boolean;
  onToggleSelection: (path: string) => void;
  onShare: (path: string) => void;
  onRetryDelete: (path: string) => void;
}

function RawLogRow({
  entry,
  selected,
  onToggleSelection,
  onShare,
  onRetryDelete,
}: RawLogRowProps) {
  const rawLog = entry.rawLog;
  const title =
    entry.kind === 'unlinked' ? 'Unlinked raw log' : entry.session.name;
  const date = new Date(entry.recordedAt).toLocaleDateString();
  const isRecording =
    entry.kind === 'session' && entry.session.status === 'active';
  const canManage = rawLog && !isRecording;

  return (
    <Card>
      <CardContent className='flex-row items-center gap-3 py-4'>
        {canManage ? (
          <Pressable
            accessibilityLabel={`Select ${title}`}
            accessibilityRole='checkbox'
            accessibilityState={{ checked: selected }}
            className={`h-7 w-7 items-center justify-center rounded-md border-2 ${selected ? 'border-primary bg-primary' : 'border-primary-foreground opacity-70'}`}
            onPress={() => onToggleSelection(rawLog.path)}
          >
            {selected && (
              <Check className='text-primary-foreground' size={16} />
            )}
          </Pressable>
        ) : (
          <View className='w-7' />
        )}
        <View className='flex-1 gap-1'>
          <Text numberOfLines={1} className='font-medium'>
            {title}
          </Text>
          {rawLog ? (
            <Muted className='text-xs'>
              {date} · {formatRawLogBytes(rawLog.size)}
            </Muted>
          ) : (
            <Muted className='text-xs'>{date} · Raw log unavailable</Muted>
          )}
          {isRecording && (
            <Muted className='text-xs'>
              Recording in progress · Cleanup unavailable
            </Muted>
          )}
        </View>
        {canManage && (
          <Button
            accessibilityLabel={`Export ${title}`}
            size='icon'
            variant='ghost'
            onPress={() => onShare(rawLog.path)}
          >
            <Share2 className='text-primary' size={18} />
          </Button>
        )}
        {canManage && entry.kind === 'unlinked' && (
          <Button
            accessibilityLabel={`Retry deleting ${title}`}
            size='sm'
            variant='outline'
            onPress={() => onRetryDelete(rawLog.path)}
          >
            <Text>Retry delete</Text>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
