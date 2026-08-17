import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  CardContent,
  H3,
  Input,
  Muted,
  Text,
  Toggle,
} from '~/components/ui';
import { useSails } from '~/features/sail';
import {
  confirmSailedLegPresentation,
  materializeCaptureReview,
  useSailedLegReview,
} from '../api/captureReview';
import { splitLegBand, unifyLegParts } from '../util/legBand';
import { createGuardedDraftSpans } from '../util/sailedLegDetection';
import type { EditableSailSpan } from '../util/spanEditing';
import { ReviewTrackMap } from './ReviewTrackMap';
import { SailSpanEditor } from './SailSpanEditor';

function editableSpansForLeg(item: {
  startTime: number;
  endTime: number;
  sailSpans: readonly EditableSailSpan[];
}) {
  // Stored rows come in carrying their `id`, and every block made from another
  // one inherits whatever it was spread from. Dropping identity at the door
  // keeps a block on screen from claiming to be a row.
  return item.sailSpans.length > 0
    ? item.sailSpans.map(({ startTime, endTime, sailId }) => ({
        startTime,
        endTime,
        sailId,
      }))
    : createGuardedDraftSpans(item.startTime, item.endTime);
}

export function SailedLegReviewPager({ sessionId }: { sessionId: number }) {
  const { legs, samples, courseMarks } = useSailedLegReview(sessionId);
  const sailsQuery = useSails();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [used, setUsed] = useState(true);
  const [finished, setFinished] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [draftSpans, setDraftSpans] = useState<Record<number, readonly EditableSailSpan[]>>({});
  const positioned = useRef(false);

  useEffect(() => {
    setSessionMissing(!materializeCaptureReview(sessionId));
    positioned.current = false;
    setIndex(0);
    setFinished(false);
    setDraftSpans({});
  }, [sessionId]);

  useEffect(() => {
    setDraftSpans(current => {
      let next = current;
      for (const item of legs.data) {
        if (next[item.id]) continue;
        if (next === current) next = { ...current };
        next[item.id] = editableSpansForLeg(item);
      }
      return next;
    });
  }, [legs.data]);

  const presentations = useMemo(
    () => legs.data.reduce<(typeof legs.data)[]>((groups, item) => {
      const current = groups.at(-1);
      if (current?.[0]?.ordinal === item.ordinal) current.push(item);
      else groups.push([item]);
      return groups;
    }, []),
    [legs.data],
  );

  useEffect(() => {
    if (positioned.current || presentations.length === 0) return;
    const firstDraft = presentations.findIndex(parts =>
      parts.some(item => item.confirmedAt === null),
    );
    setIndex(firstDraft < 0 ? presentations.length - 1 : firstDraft);
    positioned.current = true;
  }, [presentations]);

  const presentation = presentations[index];
  const leg = presentation?.[0];
  useEffect(() => {
    if (!leg || !presentation) return;
    setName(leg.name ?? `Leg ${leg.ordinal}`);
    // Stored, never inferred: a leg confirmed as used whose spans are all still
    // unattributed looks exactly like one struck out.
    setUsed(leg.used);
  }, [leg, presentation]);

  const legSamples = useMemo(
    () => presentation
      ? samples.data.filter(sample =>
          presentation.some(part =>
            sample.timestamp >= part.startTime && sample.timestamp < part.endTime,
          ),
        )
      : [],
    [presentation, samples.data],
  );
  const sampleCount = legSamples.length;

  if (sessionMissing) {
    return (
      <Card>
        <CardContent className='gap-2 py-5'>
          <H3>Capture session not found</H3>
          <Text>It was deleted while this screen was open.</Text>
        </CardContent>
      </Card>
    );
  }
  if (
    legs.updatedAt === undefined ||
    samples.updatedAt === undefined ||
    courseMarks.updatedAt === undefined
  ) {
    return <Muted>Preparing sailed legs…</Muted>;
  }
  if (!leg) {
    return (
      <Card>
        <CardContent className='gap-2 py-5'>
          <H3>No sailed legs found</H3>
          <Text>
            There was usable data, but no point of sail lasted for the three-minute minimum.
          </Text>
        </CardContent>
      </Card>
    );
  }

  const isLast = index === presentations.length - 1;
  const visibleSpans = presentation.map(part =>
    draftSpans[part.id] ?? editableSpansForLeg(part),
  );
  const allVisibleSpans = presentations.flatMap(parts =>
    parts.flatMap(part => draftSpans[part.id] ?? editableSpansForLeg(part)),
  );
  // A leg interrupted by a data gap is stored as several rows but reviewed as
  // one: two bands and two control cards, each asking to be assigned
  // separately, is the confusion this screen exists to remove.
  const band = unifyLegParts(visibleSpans);
  const advance = () => {
    confirmSailedLegPresentation({
      name,
      used,
      parts: presentation.map((part, partIndex) => ({
        legId: part.id,
        spans: visibleSpans[partIndex],
      })),
    });
    if (isLast) setFinished(true);
    else setIndex(current => current + 1);
  };

  if (finished) {
    return (
      <Card>
        <CardContent className='gap-4 py-5'>
          <H3>Review complete</H3>
          <Text>Every sailed leg you advanced past is confirmed. Unattributed samples remain in this session.</Text>
          <Button variant='outline' onPress={() => setFinished(false)}>
            <Text>Review last leg</Text>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className='gap-4 py-5'>
        <View className='flex-row items-start justify-between gap-3'>
          <View className='flex-1 gap-1'>
            <Muted>Leg {index + 1} of {presentations.length}</Muted>
            {leg.courseMarkId === null ? (
              <Input
                accessibilityLabel='Sailed leg name'
                value={name}
                onChangeText={setName}
              />
            ) : (
              <H3>{name}</H3>
            )}
          </View>
          <View className='items-end gap-1'>
            <Text>{sampleCount.toLocaleString('en-NZ')} samples</Text>
            <Toggle
              variant='outline'
              pressed={used}
              onPressedChange={setUsed}
              accessibilityLabel='Use this sailed leg'
            >
              <Text>{used ? 'Used' : 'Not used'}</Text>
            </Toggle>
          </View>
        </View>

        <ReviewTrackMap
          key={leg.ordinal}
          samples={samples.data}
          spans={allVisibleSpans}
          sails={sailsQuery?.data ?? []}
          courseMarks={courseMarks.data}
          destinationCourseMarkId={leg.courseMarkId}
          legStartTime={presentation[0].startTime}
          legEndTime={presentation.at(-1)!.endTime}
        />

        <SailSpanEditor
          // Selection is an index into this leg's blocks, so it must not
          // survive a page-turn: leg B can have the same block count as leg A
          // with a gap where A had an editable block, which leaves the editor
          // holding an unselectable index and rendering nothing at all.
          key={leg.ordinal}
          spans={band}
          sails={sailsQuery?.data ?? []}
          samples={legSamples}
          onChange={next => {
            const parts = splitLegBand(next, presentation.length);
            setDraftSpans(current => ({
              ...current,
              ...Object.fromEntries(
                presentation.map((part, partIndex) => [part.id, parts[partIndex]]),
              ),
            }));
            if (next.some(span => span.sailId !== null)) setUsed(true);
          }}
        />
        {!used && (
          <Muted>
            These {sampleCount.toLocaleString('en-NZ')} samples will stay in the recording for later attribution.
          </Muted>
        )}
        <View className='flex-row gap-3'>
          {index > 0 && (
            <Button
              className='flex-1'
              variant='outline'
              onPress={() => setIndex(current => current - 1)}
            >
              <Text>Previous</Text>
            </Button>
          )}
          <Button className='flex-1' onPress={advance} disabled={!name.trim()}>
            <Text>{isLast ? 'Finish' : 'Next'}</Text>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
