import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
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
import { useConfirm } from '~/hooks/useConfirm';
import { useSails } from '~/features/sail';
import {
  confirmSailedLegPresentation,
  materializeCaptureReview,
  redetectCaptureReview,
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

interface SailedLegReviewPagerProps {
  sessionId: number;
}

export function SailedLegReviewPager({ sessionId }: SailedLegReviewPagerProps) {
  const { legs, samples, courseMarks } = useSailedLegReview(sessionId);
  const sailsQuery = useSails();
  const confirm = useConfirm();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [used, setUsed] = useState(true);
  const [finished, setFinished] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [materializing, setMaterializing] = useState(true);
  const [draftSpans, setDraftSpans] = useState<Record<number, readonly EditableSailSpan[]>>({});
  const positioned = useRef(false);

  const resetPager = () => {
    positioned.current = false;
    setMaterializing(true);
    setIndex(0);
    setFinished(false);
    // Drafts are keyed by stored leg id, and re-detection issues new ones.
    setDraftSpans({});
  };

  const confirmedCount = legs.data.filter(item => item.confirmedAt !== null).length;
  const redetect = async () => {
    if (
      confirmedCount > 0 &&
      !(await confirm({
        title: 'Detect legs again?',
        message:
          `This session has ${confirmedCount} confirmed ` +
          `${confirmedCount === 1 ? 'leg' : 'legs'}. Detecting again rebuilds every leg ` +
          'from the recording, so those confirmations and the sails assigned to them are lost.',
        confirmText: 'Detect again',
        cancelText: 'Keep them',
        destructive: true,
      }))
    ) return;
    resetPager();
    InteractionManager.runAfterInteractions(() => {
      setSessionMissing(!redetectCaptureReview(sessionId));
      setMaterializing(false);
    });
  };

  const redetectButton = (
    <Button variant='ghost' onPress={redetect}>
      <Text>Detect legs again</Text>
    </Button>
  );

  useEffect(() => {
    resetPager();
    // Leg detection and draft attribution run synchronously inside a SQLite
    // transaction, and a multi-hour session is a lot of samples. Running that
    // straight from the effect blocks the screen's entry animation on a blank
    // frame; deferring it lets "Preparing sailed legs…" paint first, and lets
    // the push settle before the thread is taken. The work itself is still
    // synchronous once it starts.
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setSessionMissing(!materializeCaptureReview(sessionId));
      setMaterializing(false);
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
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
    materializing ||
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
          {redetectButton}
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
          {redetectButton}
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
          // Namespaced: the editor below remounts on the same leg change, and
          // a bare ordinal makes the two siblings share a key.
          key={`map-${leg.ordinal}`}
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
          key={`editor-${leg.ordinal}`}
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
        {redetectButton}
      </CardContent>
    </Card>
  );
}
