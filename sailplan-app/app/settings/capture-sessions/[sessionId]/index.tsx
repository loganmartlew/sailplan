import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Badge, Card, CardContent, H2, H3, Muted, Text } from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile';
import {
  captureWindFrameLabel,
  CapturePromotion,
  CaptureSessionReview,
  formatCaptureDuration,
  formatCaptureWindRange,
  useCaptureInset,
  useCaptureSessionCourseName,
  useCaptureSessionSummaries,
} from '~/features/capture';

const countFormat = new Intl.NumberFormat('en-NZ');

/** Uppercase muted key over its value, matching Plan's `TRUE WIND SPEED`. */
function SessionFact({ label, value }: { label: string; value: string }) {
  return (
    <View className='min-w-[30%] flex-1 gap-0.5'>
      <Muted className='text-[11px] uppercase tracking-wider'>{label}</Muted>
      <Text className='text-base font-medium'>{value}</Text>
    </View>
  );
}

export default function CaptureSessionScreen() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const { boatProfile } = useBoatProfile();
  const summaries = useCaptureSessionSummaries(boatProfile?.id ?? null);
  const session = summaries.data.find(item => item.id === sessionId);
  const courseName = useCaptureSessionCourseName(sessionId);
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
        {/* The largest type on screen names the race, not the recording. The
            session's own name is machine-made and unguessable; the course is
            what the sailor would call the day. */}
        <H2>{courseName ?? 'Capture session'}</H2>
        <Muted>
          {new Date(session.startedAt).toLocaleString('en-NZ', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </Muted>
      </View>

      {/* Hoisted above the leg work. A claim that the whole session's data may
          be systematically wrong belongs where the sailor meets it, not two and
          a half screens beneath the UI used to accept that data. */}
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

      <Card>
        <CardContent className='gap-3 py-5'>
          <View className='flex-row flex-wrap gap-4'>
            <SessionFact
              label='Duration'
              value={formatCaptureDuration(session.durationMs)}
            />
            <SessionFact
              label='Samples'
              value={countFormat.format(session.sampleCount)}
            />
            <SessionFact
              label='True wind speed'
              value={formatCaptureWindRange(session.windRange)}
            />
          </View>
          <View className='flex-row flex-wrap gap-2 pt-1'>
            <Badge variant='outline'>
              <Text>{captureWindFrameLabel(session.windFrame)}</Text>
            </Badge>
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
        <>
          <CaptureSessionReview sessionId={sessionId} />
          <CapturePromotion sessionId={sessionId} />
        </>
      )}
    </ScrollView>
  );
}
