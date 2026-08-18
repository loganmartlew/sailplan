import { Portal } from '@rn-primitives/portal';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
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
const FADE_MS = 140;
/** The chips and controls, in and out at the ends of the frame animation. */
const CHROME_MS = 120;
/**
 * `onMapLoaded` is Android-only and `onMapReady` can be swallowed on a warm
 * map. Without a backstop the overlay would stay invisible and the expand
 * control would look broken, so reveal anyway once this has passed.
 */
const REVEAL_BACKSTOP_MS = 900;

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
  onMapReady: () => void;
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
  onMapReady,
  onRegionChangeComplete,
}: ReviewTrackMapOverlayProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const revealed = useSharedValue(0);
  const chrome = useSharedValue(0);
  const hasRevealed = useRef(false);

  const full: ScreenRect = { x: 0, y: 0, width: screen.width, height: screen.height };

  /**
   * Held until the map has drawn something. Revealing on `onMapReady` showed a
   * blank frame over the inline map while the tiles were still coming, which is
   * the flash the animation is supposed to hide; `onMapLoaded` fires once there
   * is something to see, and the backstop covers iOS, which does not send it.
   */
  const reveal = useCallback(() => {
    if (hasRevealed.current) return;
    hasRevealed.current = true;
    revealed.value = withTiming(1, { duration: FADE_MS });
    progress.value = withTiming(1, { duration: EXPAND_MS }, finished => {
      if (finished) chrome.value = withTiming(1, { duration: CHROME_MS });
    });
  }, [chrome, progress, revealed]);

  useEffect(() => {
    const timer = setTimeout(reveal, REVEAL_BACKSTOP_MS);
    return () => clearTimeout(timer);
  }, [reveal]);

  useEffect(() => {
    if (!closing) return;
    // Chrome goes first so nothing is left floating over a shrinking frame.
    chrome.value = withTiming(0, { duration: CHROME_MS });
    progress.value = withTiming(0, { duration: COLLAPSE_MS }, finished => {
      if (finished) runOnJS(onClosed)();
    });
  }, [chrome, closing, onClosed, progress]);

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
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
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
            interactive
            initialRegion={initialRegion}
            style={{ flex: 1 }}
            onLayout={onLayout}
            onMapReady={onMapReady}
            onMapLoaded={reveal}
            onRegionChangeComplete={onRegionChangeComplete}
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>
        <Animated.View
          className='absolute left-3 right-3'
          style={[{ top: insets.top + 12 }, chromeStyle]}
          pointerEvents='box-none'
        >
          {focusToggle}
        </Animated.View>
        <Animated.View
          className='absolute right-3 gap-2'
          style={[{ bottom: insets.bottom + 16 }, chromeStyle]}
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
        </Animated.View>
      </Animated.View>
    </Portal>
  );
}
