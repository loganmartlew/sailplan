import { router, type Href } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { Badge, Card, CardContent, H2, Muted, Text } from '~/components/ui';
import { formatCount } from '~/lib/format';
import { ChevronRight, Wind } from '~/lib/icons';
import type { CaptureSessionSummary } from '../model/captureSessionSummary';
import { formatCaptureDuration } from '../util/formatCaptureDuration';

interface CaptureSessionListProps {
  sessions: readonly CaptureSessionSummary[];
  isLoading: boolean;
  bottomInset: number;
}

export function formatCaptureWindRange(
  windRange: CaptureSessionSummary['windRange'],
): string {
  if (!windRange) return 'No wind range';
  return `${windRange.min.toFixed(1)}–${windRange.max.toFixed(1)} kn`;
}

export function captureWindFrameLabel(
  windFrame: CaptureSessionSummary['windFrame'],
): string {
  switch (windFrame) {
    case 'water':
      return 'Water-referenced wind';
    case 'ground':
      return 'Ground-referenced wind';
    case 'instrument-corrected':
      return 'Instrument-corrected wind';
    default:
      return 'Unknown wind reference';
  }
}

export function CaptureSessionList({
  sessions,
  isLoading,
  bottomInset,
}: CaptureSessionListProps) {
  return (
    <View className='flex-1 w-full px-3 pt-5'>
      <View className='pb-4'>
        <H2>Capture sessions</H2>
        <Muted>Newest first · completed recordings for this boat</Muted>
      </View>
      <FlatList
        data={sessions}
        keyExtractor={item => item.id.toString()}
        contentContainerClassName='gap-3'
        contentContainerStyle={{ paddingBottom: bottomInset }}
        renderItem={({ item }) => <CaptureSessionRow session={item} />}
        ListEmptyComponent={
          <Card>
            <CardContent className='items-center gap-2 py-10'>
              <Wind className='text-muted-foreground' size={32} />
              <Text className='font-medium'>
                {isLoading ? 'Loading sessions…' : 'No capture sessions yet'}
              </Text>
              {!isLoading && (
                <Muted className='text-center'>
                  Record a course and it will appear here when the recording ends.
                </Muted>
              )}
            </CardContent>
          </Card>
        }
      />
    </View>
  );
}

function CaptureSessionRow({ session }: { session: CaptureSessionSummary }) {
  const date = new Date(session.startedAt).toLocaleString('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={`Open ${session.name}, ${date}`}
      onPress={() =>
        router.push(`/settings/capture-sessions/${session.id}` as Href)
      }
    >
      <Card className={session.state === 'failed' ? 'border-destructive' : undefined}>
        <CardContent className='flex-row items-center gap-3 py-4'>
          <View className='flex-1 gap-2'>
            <View className='flex-row items-start justify-between gap-2'>
              <View className='flex-1'>
                <Text numberOfLines={1} className='text-base font-medium'>
                  {session.name}
                </Text>
                <Muted className='text-xs'>{date}</Muted>
              </View>
              {session.state === 'failed' && (
                <Badge variant='destructive'>
                  <Text>Failed</Text>
                </Badge>
              )}
            </View>
            <Text className='text-sm'>
              {formatCaptureDuration(session.durationMs)} ·{' '}
              {formatCount(session.sampleCount)}{' '}
              {session.sampleCount === 1 ? 'sample' : 'samples'} ·{' '}
              {formatCaptureWindRange(session.windRange)}
            </Text>
            <View className='flex-row flex-wrap gap-2'>
              <Badge variant='outline'>
                <Text>{captureWindFrameLabel(session.windFrame)}</Text>
              </Badge>
              {session.lowWindConfidence && (
                <Badge variant='secondary'>
                  <Text>Low confidence · light wind</Text>
                </Badge>
              )}
              {session.warnsGroundWind && (
                <Badge variant='secondary'>
                  <Text>Current included</Text>
                </Badge>
              )}
            </View>
          </View>
          <ChevronRight className='text-muted-foreground' size={18} />
        </CardContent>
      </Card>
    </Pressable>
  );
}
