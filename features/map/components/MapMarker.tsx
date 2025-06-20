import { Key } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Text } from '~/components/ui';
import { Coordinate } from '../../coordinate';

interface MapMarkerProps {
  key?: Key;
  name: string;
  coords: Coordinate;
}

export function MapMarker({ key, name, coords }: MapMarkerProps) {
  return (
    <Marker
      key={key}
      coordinate={{
        latitude: coords.latitude,
        longitude: coords.longitude,
      }}
      tappable={false}
    >
      <View className='relative overflow-visible pb-1'>
        <View className='bg-primary px-2 py-1 rounded-md shadow-sm'>
          <Text className='color-primary-foreground text-sm'>{name}</Text>
        </View>
        <View className='absolute w-5 h-5 bg-primary bottom-1 left-1/2 rotate-45 -translate-x-1/2' />
      </View>
    </Marker>
  );
}
