import { useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  View,
} from 'react-native';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { Muted } from '~/components/ui/typography';
import type { Sail } from '~/features/sail/model/sail';
import { cn } from '~/lib/utils';
import {
  assignSpanSail,
  canSpanHoldBin,
  deleteDivider,
  type EditableSailSpan,
  findNearestDivider,
  MIN_SPAN_DURATION_MS,
  moveDivider,
  nudgeSpanEdge,
  splitSpan,
} from '../util/spanEditing';
import { formatCaptureDuration } from '../util/formatCaptureDuration';

interface SailSpanEditorProps {
  spans: readonly EditableSailSpan[];
  sails: readonly Pick<Sail, 'id' | 'name' | 'color'>[];
  onChange: (spans: readonly EditableSailSpan[]) => void;
}

const NUDGE_STEPS_MS = [-15_000, -5_000, 5_000, 15_000] as const;

function stepLabel(stepMs: number): string {
  return `${stepMs > 0 ? '+' : '−'}${Math.abs(stepMs) / 1_000}s`;
}

export function SailSpanEditor({ spans, sails, onChange }: SailSpanEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(Math.min(1, spans.length - 1));
  const [bandWidth, setBandWidth] = useState(0);
  const [dragPreview, setDragPreview] = useState<readonly EditableSailSpan[] | null>(null);
  const draggedDivider = useRef<number | null>(null);
  const dragPreviewRef = useRef<readonly EditableSailSpan[] | null>(null);

  useEffect(() => {
    setSelectedIndex(current => Math.max(0, Math.min(current, spans.length - 1)));
  }, [spans.length]);

  const visibleSpans = dragPreview ?? spans;
  const selected = visibleSpans[selectedIndex];
  if (!selected) return null;

  const startTime = visibleSpans[0].startTime;
  const endTime = visibleSpans.at(-1)!.endTime;
  const duration = Math.max(1, endTime - startTime);
  const timeAt = (event: GestureResponderEvent) =>
    startTime + (event.nativeEvent.locationX / Math.max(1, bandWidth)) * duration;
  const beginDrag = (event: GestureResponderEvent) => {
    draggedDivider.current = findNearestDivider(visibleSpans, timeAt(event));
    dragPreviewRef.current = visibleSpans;
    setDragPreview(visibleSpans);
    if (draggedDivider.current !== null) setSelectedIndex(draggedDivider.current);
  };
  const moveDrag = (event: GestureResponderEvent) => {
    if (draggedDivider.current === null) return;
    const next = moveDivider(
      dragPreviewRef.current ?? visibleSpans,
      draggedDivider.current,
      timeAt(event),
    );
    dragPreviewRef.current = next;
    setDragPreview(next);
  };
  const endDrag = () => {
    if (dragPreviewRef.current) onChange(dragPreviewRef.current);
    draggedDivider.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
  };
  const onBandLayout = (event: LayoutChangeEvent) => {
    setBandWidth(event.nativeEvent.layout.width);
  };

  const selectedSail = sails.find(sail => sail.id === selected.sailId);
  const canSplit = selected.endTime - selected.startTime >= MIN_SPAN_DURATION_MS * 2;

  return (
    <View className='gap-3'>
      <View
        className='relative h-14 flex-row overflow-hidden rounded-xl border border-border'
        onLayout={onBandLayout}
        onMoveShouldSetResponderCapture={() => visibleSpans.length > 1}
        onResponderGrant={beginDrag}
        onResponderMove={moveDrag}
        onResponderRelease={endDrag}
        onResponderTerminate={endDrag}
        accessibilityLabel='Sail attribution span band'
      >
        {visibleSpans.map((span, index) => {
          const sail = sails.find(item => item.id === span.sailId);
          return (
            <Pressable
              key={`${span.startTime}-${span.endTime}-${index}`}
              className={cn(
                'min-w-0 items-center justify-center border-r border-background/40 px-1',
                span.sailId === null && 'bg-muted',
                selectedIndex === index && 'border-2 border-foreground',
              )}
              style={{
                flex: Math.max(1, span.endTime - span.startTime),
                backgroundColor: sail?.color || undefined,
              }}
              onPress={() => setSelectedIndex(index)}
              accessibilityRole='button'
              accessibilityState={{ selected: selectedIndex === index }}
              accessibilityLabel={`${sail?.name ?? 'Not used'} block, ${formatCaptureDuration(span.endTime - span.startTime)}`}
            >
              <Text className={cn('text-xs font-semibold', sail && 'text-black')} numberOfLines={1}>
                {sail?.name ?? 'Not used'}
              </Text>
            </Pressable>
          );
        })}
        {visibleSpans.slice(1).map(span => (
          <View
            key={span.startTime}
            pointerEvents='none'
            className='absolute bottom-0 top-0 w-1 bg-foreground'
            style={{ left: `${((span.startTime - startTime) / duration) * 100}%` }}
          />
        ))}
      </View>
      <Muted>Drag the band to move the nearest divider. Tap a block to edit it.</Muted>

      <View className='gap-3 rounded-xl border border-border p-3'>
        <View className='flex-row items-center justify-between gap-2'>
          <Text className='font-semibold'>
            {selectedSail?.name ?? 'Not used'} · {formatCaptureDuration(selected.endTime - selected.startTime)}
          </Text>
          <Muted>Block {selectedIndex + 1} of {visibleSpans.length}</Muted>
        </View>

        {!canSpanHoldBin(selected) && (
          <Text className='text-sm text-destructive'>
            Too short to hold a 15 second polar bin. This block will not contribute a point.
          </Text>
        )}

        <View className='flex-row flex-wrap gap-2'>
          <Button
            size='sm'
            variant={selected.sailId === null ? 'secondary' : 'outline'}
            onPress={() => onChange(assignSpanSail(visibleSpans, selectedIndex, null))}
          >
            <Text>Not used</Text>
          </Button>
          {sails.map(sail => (
            <Button
              key={sail.id}
              size='sm'
              variant={selected.sailId === sail.id ? 'secondary' : 'outline'}
              onPress={() => onChange(assignSpanSail(visibleSpans, selectedIndex, sail.id))}
            >
              <View className='mr-2 h-3 w-3 rounded-full' style={{ backgroundColor: sail.color }} />
              <Text>{sail.name}</Text>
            </Button>
          ))}
        </View>

        {(['start', 'end'] as const).map(edge => {
          const disabled = edge === 'start'
            ? selectedIndex === 0
            : selectedIndex === visibleSpans.length - 1;
          return (
            <View key={edge} className='flex-row items-center gap-1'>
              <Muted className='w-10 capitalize'>{edge}</Muted>
              {NUDGE_STEPS_MS.map(step => (
                <Button
                  key={step}
                  className='flex-1 px-1'
                  size='sm'
                  variant='outline'
                  disabled={disabled}
                  onPress={() => onChange(nudgeSpanEdge(visibleSpans, selectedIndex, edge, step))}
                  accessibilityLabel={`${edge} ${stepLabel(step)}`}
                >
                  <Text className='text-sm'>{stepLabel(step)}</Text>
                </Button>
              ))}
            </View>
          );
        })}

        <View className='flex-row gap-2'>
          <Button
            className='flex-1'
            size='sm'
            variant='outline'
            disabled={!canSplit}
            onPress={() => {
              const next = splitSpan(visibleSpans, selectedIndex);
              onChange(next);
              if (next !== visibleSpans) setSelectedIndex(selectedIndex + 1);
            }}
          >
            <Text>Split block</Text>
          </Button>
          <Button
            className='flex-1'
            size='sm'
            variant='outline'
            disabled={selectedIndex === 0}
            onPress={() => {
              onChange(deleteDivider(visibleSpans, selectedIndex));
              setSelectedIndex(Math.max(0, selectedIndex - 1));
            }}
          >
            <Text>Delete divider</Text>
          </Button>
        </View>
        {!canSplit && (
          <Muted>A block needs at least 30 seconds to split into two 15 second halves.</Muted>
        )}
      </View>
    </View>
  );
}
