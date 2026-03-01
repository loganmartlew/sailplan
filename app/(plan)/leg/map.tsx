import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import MapView, { LatLng, Polyline } from 'react-native-maps';
import { Text } from '~/components/ui';
import { getLatLngCenter } from '~/features/coordinate';
import { MapMarker } from '~/features/map';
import { useMarks } from '~/features/mark';
import { useGeoLocation } from '~/hooks/useGeoLocation';

interface MarkMapSearchParams extends Record<string, string | string[]> {
  fromMarkId: string;
  toMarkId: string;
}

export default function LegMap() {
  const marksQuery = useMarks();
  const theme = useTheme();
  const { location, loading } = useGeoLocation();
  const { fromMarkId, toMarkId } = useLocalSearchParams<MarkMapSearchParams>();

  const fromMark = marksQuery?.data?.find(
    mark => fromMarkId && mark.id.toString() === fromMarkId,
  );
  const toMark = marksQuery?.data?.find(
    mark => toMarkId && mark.id.toString() === toMarkId,
  );

  const initialCoords: LatLng = useMemo(() => {
    if (fromMark && toMark) {
      const center = getLatLngCenter([fromMark, toMark]);
      return center;
    }

    return (
      location?.coords ?? {
        latitude: 0,
        longitude: 0,
      }
    );
  }, [fromMark, toMark, location]);

  if (!fromMark || !toMark) {
    return (
      <View className='flex-1 justify-center items-center'>
        <Text>Error: Marks not found</Text>
      </View>
    );
  }

  const lineCoordinates: LatLng[] = [
    { latitude: fromMark.latitude, longitude: fromMark.longitude },
    { latitude: toMark.latitude, longitude: toMark.longitude },
  ];

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className='flex-1'>
      <Stack.Screen
        options={{
          headerRight:
            fromMark && toMark
              ? () => (
                  <Text className='italic float-end whitespace-nowrap'>{`${fromMark.name} - ${toMark.name}`}</Text>
                )
              : undefined,
        }}
      />
      <MapView
        style={{ flex: 1 }}
        showsUserLocation={true}
        initialRegion={{
          latitude: initialCoords.latitude,
          longitude: initialCoords.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.05,
        }}
      >
        {[fromMark, toMark].map(mark => (
          <MapMarker
            key={mark.id}
            name={mark.name}
            coords={{ latitude: mark.latitude, longitude: mark.longitude }}
          />
        ))}
        <Polyline
          coordinates={lineCoordinates}
          strokeColor={theme.dark ? '#fff' : '#000'}
          strokeWidth={3}
        />
      </MapView>
    </View>
  );
}
