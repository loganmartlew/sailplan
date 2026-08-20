import { router, Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Card,
  CardContent,
  H3,
  Input,
  Muted,
  Text,
  Toggle,
} from '~/components/ui';
import { useSails } from '~/features/sail';
import { formatCount } from '~/lib/format';
import { ChevronLeft, ChevronRight } from '~/lib/icons';
import { updateSailedLegDraft } from '../api/captureReview';
import { useCaptureInset } from '../hooks/useCaptureInset';
import { useCaptureReview } from '../hooks/useCaptureReview';
import { splitLegBand, unifyLegParts } from '../util/legBand';
import { sailedLegName } from '../util/legReview';
import { createGuardedDraftSpans } from '../util/sailedLegDetection';
import type { EditableSailSpan } from '../util/spanEditing';
import { ReviewTrackMap } from './ReviewTrackMap';
import { SailSpanEditor } from './SailSpanEditor';

/** Long enough that typing a leg name is not a write per keystroke. */
const NAME_SAVE_DELAY_MS = 600;

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

interface SailedLegReviewProps {
  sessionId: number;
  ordinal: number;
}

/**
 * One sailed leg, on its own route, named in its own path.
 *
 * There is **no terminal action** here — no Finish, no "Review complete", no
 * bottom bar at all. Review ends by going back. Edits save as they are made, so
 * a review can be paused, wandered through and returned to tomorrow; the one
 * deliberate act, promotion, belongs to the session and happens later.
 *
 * The header's ‹ › page by `replace`, not `push`: the back stack never grows
 * past one, back always means "back to the list", and a leg stays
 * deep-linkable.
 */
export function SailedLegReview({ sessionId, ordinal }: SailedLegReviewProps) {
  const { state, samples, courseMarks, presentations, mask } =
    useCaptureReview(sessionId);
  const sailsQuery = useSails();
  const captureInset = useCaptureInset();

  const index = presentations.findIndex(parts => parts[0].ordinal === ordinal);
  const presentation = index < 0 ? undefined : presentations[index];
  const leg = presentation?.[0];

  const [name, setName] = useState('');
  const [used, setUsed] = useState(true);
  const [draftSpans, setDraftSpans] =
    useState<Record<number, readonly EditableSailSpan[]>>({});

  // Keyed on the leg, not on the query result: `useLiveQuery` hands back new
  // row objects on every write, and re-seeding the name from one of those
  // would fight the sailor's own typing.
  useEffect(() => {
    setDraftSpans({});
  }, [sessionId, ordinal]);
  useEffect(() => {
    if (!leg) return;
    setName(sailedLegName(leg));
    // Stored, never inferred: a leg kept as used whose spans are all still
    // unattributed looks exactly like one struck out.
    setUsed(leg.used);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, ordinal, leg !== undefined]);

  useEffect(() => {
    if (!presentation) return;
    setDraftSpans(current => {
      let next = current;
      for (const part of presentation) {
        if (next[part.id]) continue;
        if (next === current) next = { ...current };
        next[part.id] = editableSpansForLeg(part);
      }
      return next;
    });
  }, [presentation]);

  // Saving is what leaving a leg *is*, so it must not depend on the sailor
  // pressing anything. Spans and `used` are discrete acts and write straight
  // away; the name is debounced, and flushed when the leg changes or the
  // screen goes — the pending payload names its own leg rows, so a late flush
  // still lands on the leg it came from.
  const pending = useRef<Parameters<typeof updateSailedLegDraft>[0] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      updateSailedLegDraft(pending.current);
      pending.current = null;
    }
  };
  useEffect(() => flush, [sessionId, ordinal]);

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

  if (state === 'preparing') {
    return (
      <View className='flex-1 px-3 py-5'>
        <Muted>Preparing sailed legs…</Muted>
      </View>
    );
  }
  if (state === 'sessionMissing' || !presentation || !leg) {
    return (
      <View className='flex-1 px-3 py-5'>
        <Card>
          <CardContent className='gap-2 py-5'>
            <H3>This leg is no longer here</H3>
            <Text>
              The session was deleted, or its legs were detected again while this
              screen was open.
            </Text>
          </CardContent>
        </Card>
      </View>
    );
  }

  const visibleSpans = presentation.map(part =>
    draftSpans[part.id] ?? editableSpansForLeg(part),
  );
  // A leg interrupted by a data gap is stored as several rows but reviewed as
  // one: two bands and two control cards, each asking to be assigned
  // separately, is the confusion this screen exists to remove.
  const band = unifyLegParts(visibleSpans);
  const sampleCount = legSamples.length;
  // Read from the stored leg rather than from "this screen wrote something":
  // `reviewedAt` is set only when a save actually changes the leg, so a toggle
  // pressed twice honestly still says nothing has changed yet.
  const edited = presentation.some(part => part.reviewedAt !== null);

  const save = (
    next: {
      name?: string;
      used?: boolean;
      spans?: readonly (readonly EditableSailSpan[])[];
    },
    debounce = false,
  ) => {
    const spans = next.spans ?? visibleSpans;
    pending.current = {
      name: next.name ?? name,
      used: next.used ?? used,
      parts: presentation.map((part, partIndex) => ({
        legId: part.id,
        spans: spans[partIndex],
      })),
    };
    if (!debounce) {
      flush();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, NAME_SAVE_DELAY_MS);
  };

  const goTo = (target: number) => {
    flush();
    router.replace(
      `/settings/capture-sessions/${sessionId}/leg/${presentations[target][0].ordinal}` as Href,
    );
  };

  const stepButton = (
    direction: -1 | 1,
    Icon: typeof ChevronLeft,
    label: string,
  ) => {
    const target = index + direction;
    const enabled = target >= 0 && target < presentations.length;
    return (
      <Pressable
        className='px-1 py-2'
        disabled={!enabled}
        accessibilityRole='button'
        accessibilityLabel={label}
        onPress={() => goTo(target)}
      >
        <Icon
          className={enabled ? 'text-foreground' : 'text-muted-foreground/40'}
          size={24}
        />
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: name || sailedLegName(leg),
          headerRight: () => (
            <View className='flex-row items-center'>
              {stepButton(-1, ChevronLeft, 'Previous leg')}
              {stepButton(1, ChevronRight, 'Next leg')}
            </View>
          ),
        }}
      />
      <ScrollView
        className='flex-1'
        contentContainerClassName='w-full px-3 py-4 gap-5'
        contentContainerStyle={{ paddingBottom: captureInset }}
      >
        <View className='flex-row items-center justify-between gap-3'>
          <View className='flex-1 gap-0.5'>
            <Muted className='text-xs'>
              Leg {index + 1} of {presentations.length} ·{' '}
              {formatCount(sampleCount)} samples
            </Muted>
            {/* One word for `reviewedAt` across every surface — the list's
                badge, the session heading's count, and here. "Saved" said the
                same thing in a third vocabulary. */}
            <Muted className='text-xs'>
              {edited
                ? 'Edited — your changes are saved'
                : 'Opening default — nothing changed yet'}
            </Muted>
          </View>
          <Toggle
            variant='outline'
            pressed={used}
            onPressedChange={next => {
              setUsed(next);
              save({ used: next });
            }}
            accessibilityLabel='Use this sailed leg'
          >
            <Text>{used ? 'Used' : 'Not used'}</Text>
          </Toggle>
        </View>

        {leg.courseMarkId === null && (
          <View className='gap-1'>
            <Input
              accessibilityLabel='Sailed leg name'
              value={name}
              onChangeText={next => {
                setName(next);
                if (next.trim()) save({ name: next }, true);
              }}
            />
            {/* An empty field is not a rename to nothing — a leg has to be
                callable something. The stored name is kept and the field says
                so, rather than the save silently doing nothing. */}
            {name.trim() === '' && (
              <Muted className='text-xs'>
                A leg needs a name. Until you type one it stays{' '}
                {sailedLegName(leg)}.
              </Muted>
            )}
          </View>
        )}

        <View className='gap-2'>
          <H3>Where</H3>
          <ReviewTrackMap
            // Namespaced: the editor below remounts on the same leg change, and
            // a bare ordinal makes the two siblings share a key.
            key={`map-${leg.ordinal}`}
            samples={samples.data}
            spans={presentations.flatMap(parts =>
              parts.flatMap(part => draftSpans[part.id] ?? editableSpansForLeg(part)),
            )}
            sails={sailsQuery?.data ?? []}
            courseMarks={courseMarks.data}
            destinationCourseMarkId={leg.courseMarkId}
            legStartTime={presentation[0].startTime}
            legEndTime={presentation.at(-1)!.endTime}
          />
        </View>

        <View className='gap-2'>
          <H3>Speed and steadiness</H3>
          <SailSpanEditor
            // Selection is an index into this leg's blocks, so it must not
            // survive a page-turn: leg B can have the same block count as leg A
            // with a gap where A had an editable block, which leaves the editor
            // holding an unselectable index and rendering nothing at all.
            key={`editor-${leg.ordinal}`}
            spans={band}
            sails={sailsQuery?.data ?? []}
            samples={legSamples}
            mask={mask}
            onChange={next => {
              const parts = splitLegBand(next, presentation.length);
              setDraftSpans(current => ({
                ...current,
                ...Object.fromEntries(
                  presentation.map((part, partIndex) => [part.id, parts[partIndex]]),
                ),
              }));
              const attributed = next.some(span => span.sailId !== null);
              if (attributed) setUsed(true);
              save({ spans: parts, used: attributed ? true : undefined });
            }}
          />
        </View>

        {!used && (
          <Muted>
            These {formatCount(sampleCount)} samples will stay in the
            recording for later attribution.
          </Muted>
        )}
      </ScrollView>
    </>
  );
}
