import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Badge, Card, CardContent, H2, H3, Muted, Text } from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile';
import {
  captureWindFrameLabel,
  formatCaptureDuration,
  formatCaptureWindRange,
  useCaptureInset,
  useCaptureSessionSummaries,
} from '~/features/capture';

const countFormat = new Intl.NumberFormat('en-NZ');

export default function CaptureSessionScreen() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const { boatProfile } = useBoatProfile();
  const summaries = useCaptureSessionSummaries(boatProfile?.id ?? null);
  const session = summaries.data.find(item => item.id === sessionId);
  const captureInset = useCaptureInset();

  if (!session) {
    return (
      <View className='flex-1 items-center justify-center px-6'>
        <Muted>
          {summaries.updatedAt === undefined
            ? 'Loading session…'
            : 'This capture session is not available for the active boat.'}
        </Muted>
      </View>
    );
  }

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='w-full px-3 py-5 gap-4'
      contentContainerStyle={{ paddingBottom: captureInset }}
    >
      <View>
        <H2>{session.name}</H2>
        <Muted>
          {new Date(session.startedAt).toLocaleString('en-NZ', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </Muted>
      </View>

      <Card>
        <CardContent className='gap-2 py-5'>
          <Text>
            {formatCaptureDuration(session.durationMs)} ·{' '}
            {countFormat.format(session.sampleCount)}{' '}
            {session.sampleCount === 1 ? 'sample' : 'samples'}
          </Text>
          <Text>{formatCaptureWindRange(session.windRange)}</Text>
          <View className='flex-row flex-wrap gap-2 pt-1'>
            <Badge variant='outline'>
              <Text>{captureWindFrameLabel(session.windFrame)}</Text>
            </Badge>
            {session.lowWindConfidence && (
              <Badge variant='secondary'>
                <Text>Low confidence · light wind</Text>
              </Badge>
            )}
          </View>
        </CardContent>
      </Card>

      {session.state === 'failed' ? (
        <Card className='border-destructive'>
          <CardContent className='gap-2 py-5'>
            <H3>Nothing usable was captured</H3>
            <Text>{session.failureExplanation}</Text>
            <Muted className='pt-2'>
              There is no review to continue to for this session.
            </Muted>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='gap-2 py-5'>
            <H3>Ready to review</H3>
            <Text>
              This session has usable wind and boat-speed samples. Sailed-leg
              review starts here.
            </Text>
          </CardContent>
        </Card>
      )}

      {session.warnsGroundWind && (
        <Card className='border-amber-500'>
          <CardContent className='gap-2 py-5'>
            <H3>Ground-referenced wind</H3>
            <Text>
              This true wind includes tidal current. Any polar made from it may
              describe speed over the ground rather than the boat’s performance
              through the water.
            </Text>
          </CardContent>
        </Card>
      )}

      {session.lowWindConfidence && (
        <Card className='border-amber-500'>
          <CardContent className='gap-2 py-5'>
            <H3>Low confidence in light wind</H3>
            <Text>
              Wind shear makes readings below about 6 kn less representative of
              the wind acting on the sails.
            </Text>
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}
