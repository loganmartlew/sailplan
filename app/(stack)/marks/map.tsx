import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useMemo } from 'react';
import { useMarks } from '~/features/mark';
import { useGeoLocation } from '~/hooks/useGeoLocation';
import MapView, { Marker } from 'react-native-maps';
import { Text } from '~/components/ui';

export default function MarkMap() {
  const marksQuery = useMarks();
  const { location, loading } = useGeoLocation();

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <Stack.Screen options={{ title: 'Marks' }} />
        <Text>Loading...</Text>
      </View>
    );
  }

  console.log(location);

  return (
    <View className='flex-1'>
      <Stack.Screen options={{ title: 'Marks' }} />
      <MapView
        style={{ flex: 1 }}
        showsUserLocation={true}
        initialRegion={{
          latitude: location?.coords.latitude || 0,
          longitude: location?.coords.longitude || 0,
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
            <View className='bg-primary px-2 py-1 rounded-md shadow-sm relative'>
              <Text className='color-primary-foreground text-sm'>
                {mark.name}
              </Text>
              <View className='bg-red absolute w-10 h-10 block top-20'></View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
