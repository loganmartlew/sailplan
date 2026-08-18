import { Portal } from '@rn-primitives/portal';
import { type ReactNode, type RefObject, useEffect } from 'react';
import { BackHandler, View } from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crosshair, Minimize } from '~/lib/icons';
import type { FrameSize } from '../util/reviewMapCamera';
import type { ReviewMapMark } from '../util/reviewMapMarks';
import type { ReviewTrackSegment } from '../util/reviewTrack';
import { ReviewMapControl } from './ReviewMapControl';
import { ReviewTrackMapCanvas } from './ReviewTrackMapCanvas';

const INLINE_CORNER_RADIUS = 12;
const EXPAND_MS = 260;
const COLLAPSE_MS = 220;
/**
 * `onMapLoaded` is Android-only and `onMapReady` can be swallowed on a warm
 * map. Without a backstop the overlay would stay invisible and the expand
 * control would look broken, so reveal anyway once this has passed.
 */
const REVEAL_BACKSTOP_MS = 600;

export interface ScreenRect extends FrameSize {
  x: number;
  y: number;
}

function interpolateRect(from: ScreenRect, to: ScreenRect, t: number): ScreenRect {
  'worklet';
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

interface ReviewTrackMapOverlayProps {
  mapRef: RefObject<MapView | null>;
  /** Where on screen the inline map sits, measured at press time. */
  origin: ScreenRect;
  screen: FrameSize;
  track: readonly ReviewTrackSegment[];
  marks: readonly ReviewMapMark[];
  initialRegion?: Region;
  accessibilityLabel: string;
  /** The leg ⟷ course toggle, rendered by the owner so both frames share it. */
  focusToggle: ReactNode;
  /** True once the owner has started the close, so the frame animates back. */
  closing: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
  onRecenter: () => void;
  onLayout: () => void;
  onRegionChangeComplete: (region: Region) => void;
}

/**
 * The track at full size, grown out of the inline map's frame.
 *
 * The canvas is laid out at window size for the whole animation and never
 * resizes — only the clipping frame around it grows, with the canvas kept
 * centred inside. Since the region it opens on is pre-scaled to the window,
 * degrees-per-pixel matches the inline map exactly, so the visible pixels at
 * the start are the inline map's and the growing frame simply uncovers more
 * water. Nothing here is read by review: the whole overlay is a glance.
 */
export function ReviewTrackMapOverlay({
  mapRef,
  origin,
  screen,
  track,
  marks,
  initialRegion,
  accessibilityLabel,
  focusToggle,
  closing,
  onRequestClose,
  onClosed,
  onRecenter,
  onLayout,
  onRegionChangeComplete,
}: ReviewTrackMapOverlayProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const revealed = useSharedValue(0);

  const full: ScreenRect = { x: 0, y: 0, width: screen.width, height: screen.height };

  const reveal = () => {
    if (revealed.value === 1) return;
    revealed.value = 1;
    progress.value = withTiming(1, { duration: EXPAND_MS });
  };

  useEffect(() => {
    const timer = setTimeout(reveal, REVEAL_BACKSTOP_MS);
    return () => clearTimeout(timer);
    // Mount-only: the backstop exists precisely for the case where the map
    // never tells us it is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!closing) return;
    progress.value = withTiming(0, { duration: COLLAPSE_MS }, finished => {
      if (finished) runOnJS(onClosed)();
    });
  }, [closing, onClosed, progress]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => subscription.remove();
  }, [onRequestClose]);

  const frameStyle = useAnimatedStyle(() => {
    const rect = interpolateRect(origin, full, progress.value);
    return {
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      borderRadius: INLINE_CORNER_RADIUS * (1 - progress.value),
      opacity: revealed.value,
    };
  });
  const canvasStyle = useAnimatedStyle(() => {
    const rect = interpolateRect(origin, full, progress.value);
    return {
      left: (rect.width - screen.width) / 2,
      top: (rect.height - screen.height) / 2,
    };
  });

  return (
    <Portal name='review-track-map'>
      <Animated.View
        className='absolute overflow-hidden border border-border bg-muted'
        style={frameStyle}
      >
        <Animated.View
          className='absolute'
          style={[{ width: screen.width, height: screen.height }, canvasStyle]}
        >
          <ReviewTrackMapCanvas
            ref={mapRef}
            track={track}
            marks={marks}
            scrollEnabled
            initialRegion={initialRegion}
            style={{ flex: 1 }}
            onLayout={onLayout}
            onMapReady={reveal}
            onMapLoaded={reveal}
            onRegionChangeComplete={onRegionChangeComplete}
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>
        <View
          className='absolute left-3 right-3'
          style={{ top: insets.top + 12 }}
          pointerEvents='box-none'
        >
          {focusToggle}
        </View>
        <View
          className='absolute right-3 gap-2'
          style={{ bottom: insets.bottom + 16 }}
        >
          <ReviewMapControl
            label='Close fullscreen GPS track'
            icon={Minimize}
            onPress={onRequestClose}
          />
          <ReviewMapControl
            label='Recentre GPS track'
            icon={Crosshair}
            onPress={onRecenter}
          />
        </View>
      </Animated.View>
    </Portal>
  );
}
