import { useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Button, Muted, Text } from '~/components/ui';
import type { Sail } from '~/features/sail';
import { ChevronDown } from '~/lib/icons';
import { cn } from '~/lib/utils';
import {
  assignSpanSail,
  type EditableSailSpan,
  findNearestDivider,
  isEditableSpan,
  mergeSpan,
  MIN_SPAN_DURATION_MS,
  moveDivider,
  nudgeSpanEdge,
  spanFallsShortOfBin,
  splitSpan,
  splitTime,
} from '../util/spanEditing';
import { axisFraction, type TraceSample } from '../util/traceGeometry';
import { formatCaptureDuration } from '../util/formatCaptureDuration';
import { SailPickerSheet } from './SailPickerSheet';
import { SpanTrace } from './SpanTrace';

interface SailSpanEditorProps {
  spans: readonly EditableSailSpan[];
  sails: readonly Pick<Sail, 'id' | 'name' | 'color'>[];
  samples: readonly TraceSample[];
  onChange: (spans: readonly EditableSailSpan[]) => void;
}

const NUDGE_STEPS_MS = [-15_000, -5_000, 5_000, 15_000] as const;
const BAND_HEIGHT = 40;
const HANDLE_WIDTH = 20;
/** Horizontal travel that distinguishes a divider drag from a page scroll. */
const DRAG_SLOP_PX = 8;
/** Below this a block's own label is unreadable, so it draws none — `..` is worse than silence. */
const LABEL_MIN_WIDTH_PX = 34;

function stepLabel(stepMs: number): string {
  return `${stepMs > 0 ? '+' : '−'}${Math.abs(stepMs) / 1_000}s`;
}

/** The nearest block that can be selected — a no-data block never can. */
function nearestEditableIndex(
  spans: readonly EditableSailSpan[],
  wanted: number,
): number {
  for (let offset = 0; offset < spans.length; offset += 1) {
    for (const index of [wanted - offset, wanted + offset]) {
      if (isEditableSpan(spans[index])) return index;
    }
  }
  return 0;
}

export function SailSpanEditor({ spans, sails, samples, onChange }: SailSpanEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    nearestEditableIndex(spans, Math.min(1, spans.length - 1)),
  );
  const [bandWidth, setBandWidth] = useState(0);
  const [dragPreview, setDragPreview] = useState<readonly EditableSailSpan[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const band = useRef<View>(null);
  const bandOriginX = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const draggedDivider = useRef<number | null>(null);
  const dragPreviewRef = useRef<readonly EditableSailSpan[] | null>(null);

  useEffect(() => {
    setSelectedIndex(current =>
      nearestEditableIndex(spans, Math.max(0, Math.min(current, spans.length - 1))),
    );
    // Re-clamping on every span object would fight the drag preview; the block
    // count is what can strand a selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spans.length]);

  const visibleSpans = dragPreview ?? spans;
  const selected = visibleSpans[selectedIndex];
  if (!isEditableSpan(selected)) return null;

  const startTime = visibleSpans[0].startTime;
  const endTime = visibleSpans.at(-1)!.endTime;
  const duration = Math.max(1, endTime - startTime);
  const fraction = (time: number) => axisFraction(startTime, endTime, time);

  // `locationX` is relative to whichever view received the touch, so it is only
  // safe when that view is the band itself. Measuring the band's page-space
  // origin at touch-down — which lands well before the drag threshold is
  // crossed — keeps the divider under the finger wherever the page is scrolled.
  const timeAtPage = (pageX: number) =>
    startTime + ((pageX - bandOriginX.current) / Math.max(1, bandWidth)) * duration;
  const measureBand = () => {
    band.current?.measureInWindow(x => {
      bandOriginX.current = x;
    });
  };

  const rememberTouch = (event: GestureResponderEvent) => {
    touchStart.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
    measureBand();
    return false;
  };
  const claimHorizontalDrag = (event: GestureResponderEvent) => {
    const start = touchStart.current;
    if (!start || visibleSpans.length < 2) return false;
    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    return Math.abs(dx) > DRAG_SLOP_PX && Math.abs(dx) > Math.abs(dy);
  };
  const beginDrag = () => {
    const grabbedAt = timeAtPage(touchStart.current?.x ?? 0);
    draggedDivider.current = findNearestDivider(visibleSpans, grabbedAt);
    dragPreviewRef.current = visibleSpans;
    setDragPreview(visibleSpans);
  };
  const moveDrag = (event: GestureResponderEvent) => {
    if (draggedDivider.current === null) return;
    const next = moveDivider(
      dragPreviewRef.current ?? visibleSpans,
      draggedDivider.current,
      timeAtPage(event.nativeEvent.pageX),
    );
    dragPreviewRef.current = next;
    setDragPreview(next);
  };
  const endDrag = () => {
    if (dragPreviewRef.current) onChange(dragPreviewRef.current);
    draggedDivider.current = null;
    dragPreviewRef.current = null;
    touchStart.current = null;
    setDragPreview(null);
  };
  const onBandLayout = (event: LayoutChangeEvent) => {
    setBandWidth(event.nativeEvent.layout.width);
    measureBand();
  };

  const applyEdit = (next: readonly EditableSailSpan[], nextIndex = selectedIndex) => {
    onChange(next);
    setSelectedIndex(
      nearestEditableIndex(next, Math.max(0, Math.min(nextIndex, next.length - 1))),
    );
  };

  const selectedSail = sails.find(sail => sail.id === selected.sailId);
  const selectedDuration = selected.endTime - selected.startTime;
  const canSplit = selectedDuration >= MIN_SPAN_DURATION_MS * 2;
  const canMergeLeft = isEditableSpan(visibleSpans[selectedIndex - 1]);
  const canMergeRight = isEditableSpan(visibleSpans[selectedIndex + 1]);
  const shortBlocks = visibleSpans.flatMap((span, index) =>
    spanFallsShortOfBin(span) ? [index + 1] : [],
  );

  return (
    <View className='gap-2'>
      {/* The trace draws at the band's own measured width: they are one axis,
          and a divider a few pixels off the dip that justifies it is most of
          the trace's value gone. */}
      <SpanTrace spans={visibleSpans} samples={samples} width={bandWidth} />

      <View
        ref={band}
        style={{ height: BAND_HEIGHT }}
        className='overflow-hidden rounded-xl bg-muted'
        onLayout={onBandLayout}
        onStartShouldSetResponder={rememberTouch}
        onMoveShouldSetResponder={claimHorizontalDrag}
        onResponderGrant={beginDrag}
        onResponderMove={moveDrag}
        onResponderRelease={endDrag}
        onResponderTerminate={endDrag}
        accessibilityLabel='Sail attribution band. Drag a handle to move a divider.'
      >
        {visibleSpans.map((span, index) => {
          const sail = sails.find(item => item.id === span.sailId);
          const width = (fraction(span.endTime) - fraction(span.startTime)) * bandWidth;
          return (
            <View
              key={`block-${index}-${span.startTime}`}
              pointerEvents='none'
              className={cn(
                'absolute bottom-0 top-0 items-center justify-center',
                span.gap === true && 'bg-foreground/15',
              )}
              style={{
                left: `${fraction(span.startTime) * 100}%`,
                width: `${(fraction(span.endTime) - fraction(span.startTime)) * 100}%`,
                backgroundColor: sail?.color || undefined,
              }}
            >
              {width >= LABEL_MIN_WIDTH_PX && (
                <View className={cn('max-w-full rounded px-1', sail && 'bg-background/80')}>
                  <Text className='text-xs font-semibold' numberOfLines={1}>
                    {span.gap === true ? 'No data' : sail?.name ?? ''}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        {visibleSpans.slice(1).map((span, index) => {
          const fixed = !isEditableSpan(visibleSpans[index]) || !isEditableSpan(span);
          return fixed ? (
            <View
              key={`seam-${span.startTime}`}
              pointerEvents='none'
              className='absolute bottom-0 top-0 w-0.5 bg-foreground/50'
              style={{ left: `${fraction(span.startTime) * 100}%` }}
            />
          ) : (
            <View
              key={`handle-${span.startTime}`}
              pointerEvents='none'
              className='absolute items-center justify-center rounded-full border-2 border-background bg-foreground'
              style={{
                left: `${fraction(span.startTime) * 100}%`,
                top: (BAND_HEIGHT - 28) / 2,
                height: 28,
                width: HANDLE_WIDTH,
                marginLeft: -HANDLE_WIDTH / 2,
              }}
            />
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {visibleSpans.map((span, index) => {
          const sail = sails.find(item => item.id === span.sailId);
          const label = span.gap === true
            ? 'No data'
            : `${sail ? `${sail.name} ` : ''}${formatCaptureDuration(span.endTime - span.startTime)}`;
          return (
            <Pressable
              key={`strip-${index}-${span.startTime}`}
              disabled={span.gap === true}
              className={cn(
                'flex-row items-center gap-1.5 rounded-lg border border-border px-2 py-1.5',
                span.gap === true && 'opacity-50',
                selectedIndex === index && 'border-foreground bg-secondary',
              )}
              onPress={() => setSelectedIndex(index)}
              accessibilityRole='button'
              accessibilityState={{ selected: selectedIndex === index }}
              accessibilityLabel={`Block ${index + 1}, ${label}`}
            >
              <Muted className='text-xs'>{index + 1}</Muted>
              {sail && (
                <View
                  className='h-2.5 w-2.5 rounded-full'
                  style={{ backgroundColor: sail.color }}
                />
              )}
              <Text className='text-xs font-medium'>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Muted>Drag a handle to move a divider. Tap a numbered block to edit it.</Muted>
      {shortBlocks.length > 0 && (
        <Text className='text-sm text-destructive'>
          {`Block${shortBlocks.length === 1 ? '' : 's'} ${shortBlocks.join(', ')} ${shortBlocks.length === 1 ? 'carries a sail but is' : 'carry sails but are'} too short to hold a 15 second polar bin.`}
        </Text>
      )}

      <View className='gap-3 rounded-xl border border-border p-3'>
        <View className='flex-row items-center justify-between gap-2'>
          <Text className='font-semibold'>
            {selectedSail?.name ?? 'No sail'} · {formatCaptureDuration(selectedDuration)}
          </Text>
          <Muted>Block {selectedIndex + 1} of {visibleSpans.length}</Muted>
        </View>

        <View className='flex-row gap-2'>
          <Button
            className='flex-1 flex-row items-center justify-start gap-2'
            size='sm'
            variant='outline'
            onPress={() => setSheetOpen(true)}
            accessibilityLabel='Choose the sail for this block'
          >
            {selectedSail && (
              <View
                className='h-3 w-3 rounded-full'
                style={{ backgroundColor: selectedSail.color }}
              />
            )}
            <Text className='flex-1'>{selectedSail?.name ?? 'No sail'}</Text>
            <ChevronDown className='text-muted-foreground' size={16} />
          </Button>
          <Button
            size='sm'
            variant={selected.sailId === null ? 'secondary' : 'outline'}
            onPress={() => onChange(assignSpanSail(visibleSpans, selectedIndex, null))}
          >
            <Text>No sail</Text>
          </Button>
        </View>

        {(['start', 'end'] as const).map(edge => {
          const label = edge === 'start' ? 'Start' : 'End';
          const neighbour = visibleSpans[selectedIndex + (edge === 'start' ? -1 : 1)];
          // Four dead buttons refuse without saying why; the boundary itself is
          // the explanation.
          if (!isEditableSpan(neighbour)) {
            return (
              <Muted key={edge} className='py-1.5 text-center text-sm'>
                {neighbour === undefined ? `leg ${edge}` : 'data gap'}
              </Muted>
            );
          }
          const nudge = (step: number) => (
            <Button
              key={step}
              className='flex-1 px-1'
              size='sm'
              variant='outline'
              onPress={() => onChange(nudgeSpanEdge(visibleSpans, selectedIndex, edge, step))}
              accessibilityLabel={`${edge} ${stepLabel(step)}`}
            >
              <Text className='text-sm'>{stepLabel(step)}</Text>
            </Button>
          );
          return (
            <View key={edge} className='flex-row items-center gap-1'>
              {NUDGE_STEPS_MS.filter(step => step < 0).map(nudge)}
              <Muted className='w-12 text-center text-sm'>{label}</Muted>
              {NUDGE_STEPS_MS.filter(step => step > 0).map(nudge)}
            </View>
          );
        })}

        <View className='flex-row gap-2'>
          <Button
            className='flex-1'
            size='sm'
            variant='outline'
            disabled={!canSplit}
            onPress={() => applyEdit(splitSpan(visibleSpans, selectedIndex), selectedIndex + 1)}
          >
            <Text>Split block</Text>
          </Button>
          <Button
            className='flex-1'
            size='sm'
            variant='outline'
            disabled={!canMergeLeft}
            onPress={() => applyEdit(mergeSpan(visibleSpans, selectedIndex, 'left'), selectedIndex - 1)}
          >
            <Text>Merge left</Text>
          </Button>
          <Button
            className='flex-1'
            size='sm'
            variant='outline'
            disabled={!canMergeRight}
            onPress={() => applyEdit(mergeSpan(visibleSpans, selectedIndex, 'right'), selectedIndex)}
          >
            <Text>Merge right</Text>
          </Button>
        </View>
        <Muted>
          {canSplit
            ? `Split cuts at the block's midpoint, ${formatCaptureDuration(splitTime(selected) - startTime)} into the leg.`
            : 'A block needs at least 30 seconds to split into two 15 second halves.'}
        </Muted>
      </View>

      <SailPickerSheet
        open={sheetOpen}
        sails={sails}
        heading='Which sail was flying?'
        action='Attribute this block to'
        subtitle='This attributes the whole block, not one instant.'
        emptyMessage='Add a sail before attributing blocks.'
        onClose={() => setSheetOpen(false)}
        onSelect={sail => {
          onChange(assignSpanSail(visibleSpans, selectedIndex, sail.id));
          setSheetOpen(false);
        }}
      />
    </View>
  );
}
