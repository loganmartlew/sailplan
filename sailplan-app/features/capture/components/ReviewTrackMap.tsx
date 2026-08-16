import { useTheme } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { Muted, Text, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import type { Sail } from '~/features/sail/model/sail';
import type { CaptureSample } from '../model/capture';
import type { EditableSailSpan } from '../util/spanEditing';
import { buildReviewTrack } from '../util/reviewTrack';

type MapFocus = 'leg' | 'course';

interface ReviewTrackMapProps {
  samples: readonly CaptureSample[];
  spans: readonly EditableSailSpan[];
  sails: readonly Pick<Sail, 'id' | 'color'>[];
  legStartTime: number;
  legEndTime: number;
}

const EDGE_PADDING = { top: 28, right: 28, bottom: 28, left: 28 };

export function ReviewTrackMap({
  samples,
  spans,
  sails,
  legStartTime,
  legEndTime,
}: ReviewTrackMapProps) {
  const theme = useTheme();
  const map = useRef<MapView>(null);
  const [focus, setFocus] = useState<MapFocus>('leg');

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
  const frameTrack = () => {
    if (coordinates.length < 2) return;
    map.current?.fitToCoordinates(coordinates, {
      edgePadding: EDGE_PADDING,
      animated: false,
    });
  };

  useEffect(frameTrack, [coordinates]);

  return (
    <View className='h-56 overflow-hidden rounded-xl border border-border bg-muted'>
      {coordinates.length >= 2 ? (
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
        </MapView>
      ) : (
        <View className='flex-1 items-center justify-center px-4'>
          <Muted className='text-center'>No continuous GPS track for this view.</Muted>
        </View>
      )}
      <ToggleGroup
        type='single'
        value={focus}
        onValueChange={value => {
          if (value === 'leg' || value === 'course') setFocus(value);
        }}
        className='absolute right-2 top-2 border border-border'
        accessibilityLabel='GPS track focus'
      >
        <ToggleGroupItem value='leg' accessibilityLabel='Show this leg'>
          <Text className='text-xs'>This leg</Text>
        </ToggleGroupItem>
        <ToggleGroupItem value='course' accessibilityLabel='Show whole course'>
          <Text className='text-xs'>Whole course</Text>
        </ToggleGroupItem>
      </ToggleGroup>
    </View>
  );
}
