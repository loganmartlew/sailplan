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
  /** Panning belongs to the fullscreen frame; inline gets pinch only. */
  scrollEnabled: boolean;
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
  scrollEnabled,
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
      scrollEnabled={scrollEnabled}
      zoomEnabled
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
