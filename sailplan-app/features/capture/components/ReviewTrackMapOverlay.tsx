import { Portal } from '@rn-primitives/portal';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
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
/** The map itself, in once it has something to show. */
const MAP_FADE_MS = 220;
/** The chips and controls, in and out at the ends of the frame animation. */
const CHROME_MS = 120;
/**
 * `onMapLoaded` is Android-only, so on iOS nothing would ever fade the map in.
 * This only bounds how long a cold press can look empty; a warm map is already
 * faded in long before the sailor reaches the control.
 */
const MAP_FADE_BACKSTOP_MS = 900;

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
  /** Where on screen the inline map sits, re-measured on the way in and out. */
  origin: ScreenRect;
  /**
   * Whether the overlay is on screen. While false it is mounted, laid out at
   * full size and loading tiles, but invisible and inert — that warm-up is what
   * lets the frame grow around a map that already has something in it.
   */
  expanded: boolean;
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
  expanded,
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
  const chrome = useSharedValue(0);
  /**
   * The map's own surface paints grey or black before its tiles arrive, so it
   * stays fully transparent until it says it has drawn. The frame does not wait
   * for it: expanding starts on the press, and the map arrives into it.
   */
  const mapOpacity = useSharedValue(0);
  const hasFaded = useRef(false);
  /** The frame itself: invisible while warming, shown the instant it grows. */
  const visible = useSharedValue(0);
  /**
   * Where the portal host sits in window coordinates. `measureInWindow` gives
   * the inline map's rect in the window, but the frame is laid out inside the
   * host, and the two origins need not coincide — a status bar or a header
   * between them lands the frame off by exactly that much. Measuring the
   * discrepancy beats assuming it away.
   */
  const hostOffset = useSharedValue({ x: 0, y: 0 });
  const host = useRef<View>(null);

  const full: ScreenRect = { x: 0, y: 0, width: screen.width, height: screen.height };

  const fadeMapIn = useCallback(() => {
    if (hasFaded.current) return;
    hasFaded.current = true;
    mapOpacity.value = withTiming(1, { duration: MAP_FADE_MS });
  }, [mapOpacity]);

  useEffect(() => {
    const timer = setTimeout(fadeMapIn, MAP_FADE_BACKSTOP_MS);
    return () => clearTimeout(timer);
  }, [fadeMapIn]);

  // Parked at full size while warming, so the map loads the tiles the grown
  // frame will need. Expanding snaps the frame back onto the inline map and
  // grows from there, with something already in it to watch.
  useEffect(() => {
    if (!expanded) {
      progress.value = 1;
      visible.value = 0;
      return;
    }
    progress.value = 0;
    visible.value = 1;
    const frame = requestAnimationFrame(() => {
      progress.value = withTiming(1, { duration: EXPAND_MS }, grown => {
        if (grown) chrome.value = withTiming(1, { duration: CHROME_MS });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [chrome, expanded, progress, visible]);

  useEffect(() => {
    if (!closing) return;
    // Chrome goes first so nothing is left floating over a shrinking frame.
    chrome.value = withTiming(0, { duration: CHROME_MS });
    progress.value = withTiming(0, { duration: COLLAPSE_MS }, finished => {
      if (finished) runOnJS(onClosed)();
    });
  }, [chrome, closing, onClosed, progress]);

  useEffect(() => {
    if (!expanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => subscription.remove();
  }, [expanded, onRequestClose]);

  const frameStyle = useAnimatedStyle(() => {
    const rect = interpolateRect(origin, full, progress.value);
    return {
      left: rect.x - hostOffset.value.x,
      top: rect.y - hostOffset.value.y,
      width: rect.width,
      height: rect.height,
      borderRadius: INLINE_CORNER_RADIUS * (1 - progress.value),
      opacity: visible.value,
    };
  });
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const mapStyle = useAnimatedStyle(() => ({ opacity: mapOpacity.value }));
  const canvasStyle = useAnimatedStyle(() => {
    const rect = interpolateRect(origin, full, progress.value);
    return {
      left: (rect.width - screen.width) / 2,
      top: (rect.height - screen.height) / 2,
    };
  });

  return (
    <Portal name='review-track-map'>
      <View
        ref={host}
        style={StyleSheet.absoluteFill}
        collapsable={false}
        pointerEvents={expanded ? 'auto' : 'none'}
        onLayout={() => {
          host.current?.measureInWindow((x, y) => {
            hostOffset.value = { x, y };
          });
        }}
      >
      {/* No background of its own: until the map paints, what shows through is
          the inline map it grew out of, rather than an empty box. */}
      <Animated.View
        className='absolute overflow-hidden'
        style={frameStyle}
      >
        <Animated.View
          className='absolute'
          style={[
            { width: screen.width, height: screen.height },
            canvasStyle,
            mapStyle,
          ]}
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
            onMapLoaded={fadeMapIn}
            onRegionChangeComplete={onRegionChangeComplete}
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>
        <Animated.View
          className='absolute left-3 right-3'
          style={[{ top: insets.top + 4 }, chromeStyle]}
          pointerEvents='box-none'
        >
          {focusToggle}
        </Animated.View>
        <Animated.View
          className='absolute right-3 gap-2'
          style={[{ bottom: insets.bottom + 32 }, chromeStyle]}
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
      </View>
    </Portal>
  );
}
