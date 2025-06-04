import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useMemo } from 'react';
import { useMarks } from '~/features/mark';
import { useGeoLocation } from '~/hooks/useGeoLocation';
import MapView, { LatLng, Marker, Polyline } from 'react-native-maps';
import { Text } from '~/components/ui';
import { useTheme } from '@react-navigation/native';
import { getLatLngCenter } from '~/features/coordinate';

interface MarkMapSearchParams extends Record<string, string | string[]> {
  fromMarkId: string;
  toMarkId: string;
}

export default function MarkMap() {
  const marksQuery = useMarks();
  const theme = useTheme();
  const { location, loading } = useGeoLocation();
  const { fromMarkId, toMarkId } = useLocalSearchParams<MarkMapSearchParams>();

  const fromMark = marksQuery?.data?.find(
    mark => fromMarkId && mark.id.toString() === fromMarkId
  );
  const toMark = marksQuery?.data?.find(
    mark => toMarkId && mark.id.toString() === toMarkId
  );

  const lineCoordinates: LatLng[] = useMemo(() => {
    if (!marksQuery.data || !fromMarkId || !toMarkId) return [];
    if (!fromMark || !toMark) return [];

    return [
      { latitude: fromMark.latitude, longitude: fromMark.longitude },
      { latitude: toMark.latitude, longitude: toMark.longitude },
    ];
  }, [marksQuery.data, fromMarkId, fromMark, toMarkId, toMark]);

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

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <Stack.Screen options={{ title: 'Marks' }} />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View className='flex-1'>
      <Stack.Screen
        options={{
          title: 'Marks',
          headerRight: () =>
            fromMark && toMark ? (
              <Text className='italic float-end'>{`${fromMark.name} - ${toMark.name}`}</Text>
            ) : null,
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
        {marksQuery.data?.map(mark => (
          <Marker
            key={mark.id}
            coordinate={{
              latitude: mark.latitude,
              longitude: mark.longitude,
            }}
            tappable={false}
          >
            <View className='relative overflow-visible pb-1'>
              <View className='bg-primary px-2 py-1 rounded-md shadow-sm'>
                <Text className='color-primary-foreground text-sm'>
                  {mark.name}
                </Text>
              </View>
              <View className='absolute w-5 h-5 bg-primary bottom-1 left-1/2 rotate-45 -translate-x-1/2' />
            </View>
          </Marker>
        ))}
        <Polyline
          coordinates={lineCoordinates}
          strokeColor={theme.colors.primary}
          strokeWidth={3}
        />
      </MapView>
    </View>
  );
}
