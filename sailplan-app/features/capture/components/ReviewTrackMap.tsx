import { useTheme } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { Muted, Text, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { MapMarker } from '~/features/map';
import type { Sail } from '~/features/sail/model/sail';
import type { CaptureSample } from '../model/capture';
import {
  type ReviewMapFocus,
  type ReviewMapMark,
  selectReviewMapFrame,
  selectReviewMapMarks,
} from '../util/reviewMapMarks';
import type { EditableSailSpan } from '../util/spanEditing';
import { buildReviewTrack } from '../util/reviewTrack';

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
  const map = useRef<MapView>(null);
  const [focus, setFocus] = useState<ReviewMapFocus>('leg');

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
  const frameTrack = () => {
    if (frameCoordinates.length === 0) return;
    if (frameCoordinates.length === 1) {
      map.current?.animateToRegion({
        ...frameCoordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 0);
      return;
    }
    map.current?.fitToCoordinates([...frameCoordinates], {
      edgePadding: EDGE_PADDING,
      animated: false,
    });
  };

  useEffect(frameTrack, [frameCoordinates]);

  return (
    <View className='gap-2'>
      <ToggleGroup
        type='single'
        value={focus}
        onValueChange={value => {
          if (value === 'leg' || value === 'course') setFocus(value);
        }}
        className='self-end border border-border'
        accessibilityLabel='GPS track focus'
      >
        <ToggleGroupItem value='leg' accessibilityLabel='Show this leg'>
          <Text className='text-xs'>This leg</Text>
        </ToggleGroupItem>
        <ToggleGroupItem value='course' accessibilityLabel='Show whole course'>
          <Text className='text-xs'>Whole course</Text>
        </ToggleGroupItem>
      </ToggleGroup>
      <View className='h-56 overflow-hidden rounded-xl border border-border bg-muted'>
        {frameCoordinates.length > 0 ? (
          <MapView
            ref={map}
            pointerEvents='none'
            style={{ flex: 1 }}
            mapType='none'
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            showsCompass={false}
            showsBuildings={false}
            showsIndoors={false}
            showsPointsOfInterests={false}
            showsTraffic={false}
            onLayout={frameTrack}
            onMapReady={frameTrack}
            accessibilityLabel={`Read-only GPS track, ${focus === 'leg' ? 'this leg' : 'whole course'}`}
          >
            {track.map((segment, index) => (
              <Polyline
                key={`${segment.coordinates[0].timestamp}-${index}`}
                coordinates={segment.coordinates}
                strokeColor={segment.color}
                strokeWidth={4}
              />
            ))}
            {visibleMarks.map(courseMark => (
              <MapMarker
                key={courseMark.id}
                name={courseMark.name}
                coords={courseMark}
              />
            ))}
          </MapView>
        ) : (
          <View className='flex-1 items-center justify-center px-4'>
            <Muted className='text-center'>No continuous GPS track for this view.</Muted>
          </View>
        )}
      </View>
    </View>
  );
}
