import { ActivityIndicator, View } from 'react-native';
import { useMarks } from '~/features/mark';
import { useGeoLocation } from '~/hooks/useGeoLocation';
import MapView, { LatLng } from 'react-native-maps';
import { MapMarker } from '~/features/map';

export default function MarkMap() {
  const marksQuery = useMarks();
  const { location, loading } = useGeoLocation();

  const initialCoords: LatLng = location?.coords ?? {
    latitude: 0,
    longitude: 0,
  };

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className='flex-1'>
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
          <MapMarker
            key={mark.id}
            name={mark.name}
            coords={{ latitude: mark.latitude, longitude: mark.longitude }}
          />
        ))}
      </MapView>
    </View>
  );
}
