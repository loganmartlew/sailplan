import { ActivityIndicator, View } from 'react-native';
import MapView, { LatLng, Marker } from 'react-native-maps';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { Coordinate, getLatLngCenter } from '~/features/coordinate';
import { Mark } from '~/features/mark';
import { MapMarker } from './MapMarker';
import { useMemo, useState } from 'react';
import { useGeoLocation } from '~/hooks/useGeoLocation';
import { deDupe } from '~/lib/array';
import { useSettings } from '~/features/settings';

interface SelectLocationDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSelectLocation: (location: Coordinate) => void;
  marks?: Mark[];
}

export function SelectLocationDialog({
  open,
  onOpenChange,
  onSelectLocation,
  marks = [],
}: SelectLocationDialogProps) {
  const { location, loading } = useGeoLocation();
  const { mapZoom } = useSettings();

  const [pinLocation, setPinLocation] = useState<LatLng | null>(null);

  const initialCoords: LatLng = useMemo(() => {
    if (marks.length > 0) {
      const center = getLatLngCenter(
        marks.map(mark => ({
          latitude: mark.latitude,
          longitude: mark.longitude,
        })),
      );
      return center;
    }

    return (
      location?.coords ?? {
        latitude: 0,
        longitude: 0,
      }
    );
  }, [marks, location]);

  const dedupedMarks = useMemo(
    () => deDupe(marks, mark => mark.id.toString()),
    [marks],
  );

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent className='w-[500px] max-w-[100vw] h-[80vh]'>
        <DialogHeader>
          <DialogTitle>Select Location</DialogTitle>
        </DialogHeader>
        <View className='flex-1'>
          <MapView
            style={{ flex: 1 }}
            showsUserLocation={true}
            initialRegion={{
              latitude: initialCoords.latitude,
              longitude: initialCoords.longitude,
              latitudeDelta: mapZoom,
              longitudeDelta: mapZoom / 3,
            }}
            onPress={e => setPinLocation(e.nativeEvent.coordinate)}
          >
            {dedupedMarks.map(mark => (
              <MapMarker
                key={mark.id}
                name={mark.name}
                coords={{ latitude: mark.latitude, longitude: mark.longitude }}
              />
            ))}
            {pinLocation && (
              <Marker
                coordinate={pinLocation}
                title='Selected Location'
                pinColor='blue'
              />
            )}
          </MapView>
        </View>
        <DialogFooter className='flex flex-row gap-2'>
          <Button
            className='flex-1'
            variant='secondary'
            onPress={() => {
              setPinLocation(null);
              onOpenChange(false);
            }}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            className='flex-1'
            onPress={() => {
              onSelectLocation(pinLocation!);
              onOpenChange(false);
              setPinLocation(null);
            }}
            disabled={!pinLocation}
          >
            <Text>Save</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
