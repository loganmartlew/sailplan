import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { H3, Muted } from '~/components/ui/typography';
import { Toggle } from '~/components/ui/toggle';
import {
  confirmSailedLegPresentation,
  materializeCaptureReview,
  useSailedLegReview,
} from '../api/captureReview';
import { createGuardedDraftSpans } from '../util/sailedLegDetection';

export function SailedLegReviewPager({ sessionId }: { sessionId: number }) {
  const { legs, samples } = useSailedLegReview(sessionId);
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [used, setUsed] = useState(true);
  const [finished, setFinished] = useState(false);
  const positioned = useRef(false);

  useEffect(() => {
    materializeCaptureReview(sessionId);
    positioned.current = false;
    setIndex(0);
    setFinished(false);
  }, [sessionId]);

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
    // A confirmed leg with no spans is the durable whole-leg "not used" state.
    setUsed(
      presentation.some(part => part.confirmedAt === null) ||
      presentation.some(part => part.sailSpans.length > 0),
    );
  }, [leg, presentation]);

  const pointCount = useMemo(
    () => presentation
      ? samples.data.filter(sample =>
          presentation.some(part =>
            sample.timestamp >= part.startTime && sample.timestamp < part.endTime,
          ),
        ).length
      : 0,
    [presentation, samples.data],
  );

  if (legs.updatedAt === undefined || samples.updatedAt === undefined) {
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
    part.sailSpans.length > 0
      ? part.sailSpans
      : createGuardedDraftSpans(part.startTime, part.endTime),
  );
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
            <Text>{pointCount.toLocaleString('en-NZ')} points</Text>
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

        {visibleSpans.map((partSpans, partIndex) => (
          <View key={presentation[partIndex].id} className='gap-1'>
            {partIndex > 0 && <Muted>Continued after data gap</Muted>}
            <View className='flex-row overflow-hidden rounded-xl border border-border'>
              {partSpans.map((span, spanIndex) => {
                const duration = Math.max(1, span.endTime - span.startTime);
                return (
                  <View
                    key={`${span.startTime}-${span.endTime}`}
                    className={spanIndex === 1 ? 'items-center bg-secondary px-2 py-4' : 'items-center bg-muted px-2 py-4'}
                    style={{ flex: duration }}
                  >
                    <Text className='text-xs' numberOfLines={1}>
                      {spanIndex === 1 ? 'Unattributed' : 'Not used'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
        {!used && (
          <Muted>These {pointCount.toLocaleString('en-NZ')} points will stay in the recording for later attribution.</Muted>
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
