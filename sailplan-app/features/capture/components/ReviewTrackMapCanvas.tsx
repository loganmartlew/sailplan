import type { Ref } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import MapView, { type Region, Polyline } from 'react-native-maps';
import { MapMarker } from '~/features/map';
import type { ReviewMapMark } from '../util/reviewMapMarks';
import type { ReviewTrackSegment } from '../util/reviewTrack';

interface ReviewTrackMapCanvasProps {
  ref: Ref<MapView>;
  track: readonly ReviewTrackSegment[];
  marks: readonly ReviewMapMark[];
  /**
   * Only the fullscreen frame takes touches. Inline stays a thumbnail: a map
   * that small answers nothing a gesture could ask, and letting it take touches
   * only steals them from the review screen's scroll.
   */
  interactive: boolean;
  initialRegion?: Region;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMapReady?: () => void;
  onMapLoaded?: () => void;
  onRegionChangeComplete: (region: Region) => void;
}

/**
 * The track itself, drawn the same way inline and fullscreen. Both frames share
 * this so the sail colours, the marks and the gap-split polylines cannot drift
 * apart between them.
 */
export function ReviewTrackMapCanvas({
  ref,
  track,
  marks,
  interactive,
  initialRegion,
  style,
  accessibilityLabel,
  onLayout,
  onMapReady,
  onMapLoaded,
  onRegionChangeComplete,
}: ReviewTrackMapCanvasProps) {
  return (
    <MapView
      ref={ref}
      style={style}
      initialRegion={initialRegion}
      mapType='standard'
      pointerEvents={interactive ? 'auto' : 'none'}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsCompass={false}
      showsBuildings={false}
      showsIndoors={false}
      showsPointsOfInterests={false}
      showsTraffic={false}
      onLayout={onLayout}
      onMapReady={onMapReady}
      onMapLoaded={onMapLoaded}
      onRegionChangeComplete={onRegionChangeComplete}
      accessibilityLabel={accessibilityLabel}
    >
      {track.map((segment, index) => (
        <Polyline
          key={`${segment.coordinates[0].timestamp}-${index}`}
          coordinates={segment.coordinates}
          strokeColor={segment.color}
          strokeWidth={4}
        />
      ))}
      {marks.map(courseMark => (
        <MapMarker
          key={courseMark.id}
          name={courseMark.name}
          coords={courseMark}
        />
      ))}
    </MapView>
  );
}
