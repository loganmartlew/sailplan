import { useTheme } from '@react-navigation/native';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { Muted, Text, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { Crosshair, Maximize } from '~/lib/icons';
import type { Sail } from '~/features/sail/model/sail';
import type { CaptureSample } from '../model/capture';
import {
  type FrameSize,
  type MapRegion,
  type ReviewMapCameraEvent,
  type ReviewMapCameraState,
  initialReviewMapCamera,
  regionForCoordinates,
  rescaleRegion,
  stepReviewMapCamera,
} from '../util/reviewMapCamera';
import {
  type ReviewMapFocus,
  type ReviewMapMark,
  selectReviewMapFrame,
  selectReviewMapMarks,
} from '../util/reviewMapMarks';
import type { EditableSailSpan } from '../util/spanEditing';
import { buildReviewTrack } from '../util/reviewTrack';
import { ReviewMapControl } from './ReviewMapControl';
import { ReviewTrackMapCanvas } from './ReviewTrackMapCanvas';
import { type ScreenRect, ReviewTrackMapOverlay } from './ReviewTrackMapOverlay';

interface ReviewTrackMapProps {
  samples: readonly CaptureSample[];
  spans: readonly EditableSailSpan[];
  sails: readonly Pick<Sail, 'id' | 'color'>[];
  courseMarks: readonly ReviewMapMark[];
  destinationCourseMarkId: number | null;
  legStartTime: number;
  legEndTime: number;
}

const EDGE_PADDING = { top: 56, right: 56, bottom: 40, left: 56 };
/** Matches the `h-56` inline box. */
const INLINE_MAP_HEIGHT = 224;

type FrameKey = 'inline' | 'fullscreen';

/**
 * One map, in one of its two frames. Camera work always names the frame it acts
 * on, so the map ref, the size the region maths divides by, the last settled
 * region and the "we moved this ourselves" flag cannot drift apart.
 */
interface MapFrame {
  readonly map: RefObject<MapView | null>;
  size: FrameSize;
  region: MapRegion | null;
  /**
   * Whether the native map will act on a camera call yet. Fitting before this
   * is a silent no-op, so the latch must not count it as framed — that is what
   * used to leave the inline map sitting on the whole world.
   */
  ready: boolean;
  /**
   * A region settling because we moved the camera is not the sailor moving it.
   * Without this every programmatic fit would latch the camera against itself.
   */
  programmatic: boolean;
}

export function ReviewTrackMap({
  samples,
  spans,
  sails,
  courseMarks,
  destinationCourseMarkId,
  legStartTime,
  legEndTime,
}: ReviewTrackMapProps) {
  const theme = useTheme();
  const window = useWindowDimensions();
  const [focus, setFocus] = useState<ReviewMapFocus>('leg');
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [origin, setOrigin] = useState<ScreenRect | null>(null);
  const [openRegion, setOpenRegion] = useState<Region | undefined>(undefined);

  const inlineMap = useRef<MapView>(null);
  const fullscreenMap = useRef<MapView>(null);
  /** The map's own rect, so the overlay starts on exactly the pixels it shows. */
  const inlineCanvasBox = useRef<View>(null);
  const frames = useRef<Record<FrameKey, MapFrame>>({
    inline: {
      map: inlineMap,
      size: { width: 0, height: 0 },
      region: null,
      ready: false,
      programmatic: false,
    },
    fullscreen: {
      map: fullscreenMap,
      size: { width: 0, height: 0 },
      region: null,
      ready: false,
      programmatic: false,
    },
  });
  const camera = useRef<ReviewMapCameraState>(initialReviewMapCamera);
  const previousFocus = useRef<ReviewMapFocus>(focus);

  const screen: FrameSize = useMemo(
    () => ({ width: window.width, height: window.height }),
    [window.height, window.width],
  );

  const visibleSamples = useMemo(
    () => focus === 'course'
      ? samples
      : samples.filter(sample =>
          sample.timestamp >= legStartTime && sample.timestamp < legEndTime,
        ),
    [focus, legEndTime, legStartTime, samples],
  );
  const coloredSpans = useMemo(
    () => spans.map(span => ({
      startTime: span.startTime,
      endTime: span.endTime,
      color: sails.find(sail => sail.id === span.sailId)?.color ?? theme.colors.border,
    })),
    [sails, spans, theme.colors.border],
  );
  const track = useMemo(
    () => buildReviewTrack({
      samples: visibleSamples,
      spans: coloredSpans,
      fallbackColor: theme.colors.border,
    }),
    [coloredSpans, theme.colors.border, visibleSamples],
  );
  const coordinates = useMemo(
    () => track.flatMap(segment => segment.coordinates),
    [track],
  );
  const visibleMarks = useMemo(
    () => selectReviewMapMarks(focus, courseMarks, destinationCourseMarkId),
    [courseMarks, destinationCourseMarkId, focus],
  );
  const frameCoordinates = useMemo(
    () => selectReviewMapFrame(
      coordinates,
      visibleMarks.map(mark => ({
        latitude: mark.latitude,
        longitude: mark.longitude,
      })),
    ),
    [coordinates, visibleMarks],
  );

  const activeFrame = useCallback(
    () => frames.current[expanded ? 'fullscreen' : 'inline'],
    [expanded],
  );

  const frameTrack = useCallback(() => {
    const frame = activeFrame();
    if (!frame.map.current || frameCoordinates.length === 0) return;
    frame.programmatic = true;
    if (frameCoordinates.length === 1) {
      frame.map.current.animateToRegion({
        ...frameCoordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 0);
      return;
    }
    frame.map.current.fitToCoordinates([...frameCoordinates], {
      edgePadding: EDGE_PADDING,
      animated: false,
    });
  }, [activeFrame, frameCoordinates]);

  const dispatch = useCallback((event: ReviewMapCameraEvent) => {
    const step = stepReviewMapCamera(
      camera.current,
      event,
      frameCoordinates.length > 0 && activeFrame().ready,
    );
    camera.current = step.state;
    if (step.fit) frameTrack();
  }, [activeFrame, frameCoordinates.length, frameTrack]);

  // One effect for both, because switching focus also changes the coordinates:
  // running them separately would fire a spurious track change alongside it.
  useEffect(() => {
    const event = previousFocus.current === focus ? 'trackChange' : 'focusChange';
    previousFocus.current = focus;
    dispatch(event);
  }, [dispatch, focus, frameCoordinates]);

  const onRegionSettled = (key: FrameKey) => (region: Region) => {
    const frame = frames.current[key];
    frame.region = region;
    if (frame.programmatic) {
      frame.programmatic = false;
      return;
    }
    dispatch('gesture');
  };

  const measureInlineCanvas = (then: (rect: ScreenRect) => void) => {
    // Measured on demand rather than kept from layout: the rect is stale the
    // moment the sailor scrolls the review screen, on the way in and out both.
    inlineCanvasBox.current?.measureInWindow((x, y, width, height) =>
      then({ x, y, width, height }),
    );
  };

  const expand = () => {
    measureInlineCanvas(rect => {
      const inline = frames.current.inline;
      // The inline map may not have reported a region yet on a fast press.
      // Deriving the fit it is about to settle on keeps the fullscreen frame
      // opening on what the sailor can already see, rather than on a fresh fit.
      const from = inline.region
        ?? regionForCoordinates(frameCoordinates, inline.size, EDGE_PADDING);
      frames.current.fullscreen.size = screen;
      frames.current.fullscreen.region = null;
      setOpenRegion(from ? rescaleRegion(from, inline.size, screen) : undefined);
      setOrigin(rect);
      setExpanded(true);
    });
  };

  const collapse = useCallback(() => {
    const { inline, fullscreen } = frames.current;
    // Hand the fullscreen camera back before the overlay goes, so the track
    // does not jump at the end of the animation.
    if (fullscreen.region && inline.size.height > 0) {
      inline.programmatic = true;
      inline.map.current?.animateToRegion(
        rescaleRegion(fullscreen.region, screen, inline.size),
        0,
      );
    }
    measureInlineCanvas(rect => setOrigin(rect));
    setClosing(true);
  }, [screen]);

  const onClosed = useCallback(() => {
    setExpanded(false);
    setClosing(false);
    setOrigin(null);
  }, []);

  const hasTrack = frameCoordinates.length > 0;
  // The map takes this only on its first mount, so it is the frame the sailor
  // sees before any fit lands. Height is the fixed h-56 box; width is close
  // enough that the fit arriving behind it is an adjustment, not a jump.
  const inlineInitialRegion = useRef<Region | undefined>(undefined);
  if (hasTrack && !inlineInitialRegion.current) {
    inlineInitialRegion.current = regionForCoordinates(
      frameCoordinates,
      { width: screen.width, height: INLINE_MAP_HEIGHT },
      EDGE_PADDING,
    ) ?? undefined;
  }
  const focusLabel = focus === 'leg' ? 'this leg' : 'whole course';
  const recenter = () => dispatch('recenter');

  const focusToggle = (
    <ToggleGroup
      type='single'
      value={focus}
      onValueChange={value => {
        if (value === 'leg' || value === 'course') setFocus(value);
      }}
      className='self-end border border-border bg-background'
      accessibilityLabel='GPS track focus'
    >
      <ToggleGroupItem value='leg' accessibilityLabel='Show this leg'>
        <Text className='text-xs'>This leg</Text>
      </ToggleGroupItem>
      <ToggleGroupItem value='course' accessibilityLabel='Show whole course'>
        <Text className='text-xs'>Whole course</Text>
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <View className='gap-2'>
      {focusToggle}
      <View className='h-56 overflow-hidden rounded-xl border border-border bg-muted'>
        {hasTrack ? (
          <>
            <View ref={inlineCanvasBox} collapsable={false} className='flex-1'>
              <ReviewTrackMapCanvas
                ref={inlineMap}
                track={track}
                marks={visibleMarks}
                interactive={false}
                initialRegion={inlineInitialRegion.current}
                style={{ flex: 1 }}
                onLayout={event => {
                  // The map's own box, not the bordered one around it: the
                  // region maths divides by this, so a couple of pixels of
                  // border would put the fullscreen scale slightly out.
                  frames.current.inline.size = event.nativeEvent.layout;
                  dispatch('layout');
                }}
                onMapReady={() => {
                  frames.current.inline.ready = true;
                  dispatch('layout');
                }}
                onRegionChangeComplete={onRegionSettled('inline')}
                accessibilityLabel={`Read-only GPS track, ${focusLabel}. Expand to explore it.`}
              />
            </View>
            <View className='absolute bottom-2 right-2 gap-2'>
              <ReviewMapControl
                label='Expand GPS track'
                icon={Maximize}
                onPress={expand}
              />
              <ReviewMapControl
                label='Recentre GPS track'
                icon={Crosshair}
                onPress={recenter}
              />
            </View>
          </>
        ) : (
          <View className='flex-1 items-center justify-center px-4'>
            <Muted className='text-center'>No continuous GPS track for this view.</Muted>
          </View>
        )}
      </View>

      {expanded && origin && (
        <ReviewTrackMapOverlay
          mapRef={fullscreenMap}
          origin={origin}
          screen={screen}
          track={track}
          marks={visibleMarks}
          initialRegion={openRegion}
          accessibilityLabel={`GPS track fullscreen, ${focusLabel}. Pan and pinch to zoom.`}
          focusToggle={focusToggle}
          closing={closing}
          onRequestClose={collapse}
          onClosed={onClosed}
          onRecenter={recenter}
          onLayout={() => dispatch('layout')}
          onMapReady={() => {
            frames.current.fullscreen.ready = true;
            dispatch('layout');
          }}
          onRegionChangeComplete={onRegionSettled('fullscreen')}
        />
      )}
    </View>
  );
}
