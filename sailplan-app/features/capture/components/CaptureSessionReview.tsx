import { router, type Href } from 'expo-router';
import { InteractionManager } from 'react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, CardContent, H3, Muted, Text } from '~/components/ui';
import { useConfirm } from '~/hooks/useConfirm';
import { useSails } from '~/features/sail';
import { redetectCaptureReview } from '../api/captureReview';
import { useCaptureReview } from '../hooks/useCaptureReview';
import { ReviewTrackMap } from './ReviewTrackMap';
import { SailedLegList } from './SailedLegList';

interface CaptureSessionReviewProps {
  sessionId: number;
}

/**
 * The session's sailed legs, as a list.
 *
 * The list is review's home. Before this the only way to learn what was in a
 * session was to page through it, one leg at a time, in an order that answered
 * *which leg am I on* — a question that stops mattering once there is no linear
 * pass to be partway through. *Which legs still need work* is the question that
 * replaces it, and that is a list.
 */
export function CaptureSessionReview({ sessionId }: CaptureSessionReviewProps) {
  const { state, samples, courseMarks, summaries, legs } = useCaptureReview(sessionId);
  const sailsQuery = useSails();
  const confirm = useConfirm();
  const [redetecting, setRedetecting] = useState(false);

  const reviewedCount = summaries.filter(leg => leg.reviewed).length;
  const redetect = async () => {
    if (
      reviewedCount > 0
      && !(await confirm({
        title: 'Detect legs again?',
        message:
          `This session has ${reviewedCount} reviewed `
          + `${reviewedCount === 1 ? 'leg' : 'legs'}. Detecting again rebuilds every leg `
          + 'from the recording, so those edits and the sails assigned to them are lost.',
        confirmText: 'Detect again',
        cancelText: 'Keep them',
        destructive: true,
      }))
    ) return;
    setRedetecting(true);
    InteractionManager.runAfterInteractions(() => {
      redetectCaptureReview(sessionId);
      setRedetecting(false);
    });
  };

  const redetectButton = (
    <Button variant='ghost' onPress={redetect} disabled={redetecting}>
      <Text>Detect legs again</Text>
    </Button>
  );

  if (state === 'sessionMissing') {
    return (
      <Card>
        <CardContent className='gap-2 py-5'>
          <H3>Capture session not found</H3>
          <Text>It was deleted while this screen was open.</Text>
        </CardContent>
      </Card>
    );
  }
  if (state === 'preparing' || redetecting) {
    return <Muted>Preparing sailed legs…</Muted>;
  }
  if (summaries.length === 0) {
    return (
      <Card>
        <CardContent className='gap-2 py-5'>
          <H3>No sailed legs found</H3>
          <Text>
            There was usable data, but no point of sail lasted for the three-minute minimum.
          </Text>
          {redetectButton}
        </CardContent>
      </Card>
    );
  }

  return (
    <View className='gap-4'>
      <ReviewTrackMap
        samples={samples.data}
        spans={legs.data.flatMap(leg => leg.sailSpans)}
        sails={sailsQuery?.data ?? []}
        courseMarks={courseMarks.data}
        destinationCourseMarkId={null}
        legStartTime={summaries[0].startTime}
        legEndTime={summaries.at(-1)!.endTime}
        initialFocus='course'
        showFocusToggle={false}
      />
      <View className='gap-1'>
        <H3>
          {summaries.length} sailed {summaries.length === 1 ? 'leg' : 'legs'}
          {reviewedCount > 0 ? ` · ${reviewedCount} edited` : ''}
        </H3>
        {/* Said once, here, rather than left for the sailor to infer from a
            pill: a steady bin is 15 s of settled sailing, and promotion needs
            several in the same wind and angle before it writes one point. The
            reference race gives 88 bins and 10 points. */}
        <Muted className='text-xs'>
          A steady bin is 15 seconds of settled sailing. Promotion needs several
          in the same wind and angle to write one polar point, so points come out
          far fewer than bins.
        </Muted>
      </View>
      <SailedLegList
        legs={summaries}
        sails={sailsQuery?.data ?? []}
        onOpen={leg =>
          router.push(
            `/settings/capture-sessions/${sessionId}/leg/${leg.ordinal}` as Href,
          )
        }
      />
      {redetectButton}
    </View>
  );
}
