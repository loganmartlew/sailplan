import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { Text } from '~/components/ui';

export default function MarkMap() {
  let MapComponent: typeof AppleMaps.View | typeof GoogleMaps.View | null =
    null;
  if (Platform.OS === 'ios') {
    MapComponent = AppleMaps.View;
  } else if (Platform.OS === 'android') {
    MapComponent = GoogleMaps.View;
  }

  if (!MapComponent) {
    return <Text>Maps are only available on Android and iOS</Text>;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Marks' }} />
      <MapComponent style={{ flex: 1 }} />
    </View>
  );
}
