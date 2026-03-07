import { View } from 'react-native';
import { Button, H2, Input, Label, Text } from '~/components/ui';
import { useBufferedInput } from '~/hooks/useBufferedInput';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { useSettings } from '~/features/settings';
import { DEFAULT_SETTINGS } from '~/features/settings';
import { CoordFormatInfoButton } from '~/features/coordinate';
import { RefreshCw, TextCursorInput } from '~/lib/icons';
import type {
  CoordFormatDefault,
  HemisphereLatitude,
  HemisphereLongitude,
} from '~/features/settings';

export default function DefaultsSettings() {
  const {
    coordFormat,
    setCoordFormat,
    hemisphereLatitude,
    setHemisphereLatitude,
    hemisphereLongitude,
    setHemisphereLongitude,
    mapZoom,
    setMapZoom,
  } = useSettings();

  const mapZoomInput = useBufferedInput(String(mapZoom), text => {
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      setMapZoom(parsed);
    }
  });

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-8'>
      <View className='flex-row items-center gap-2'>
        <TextCursorInput className='text-foreground' size={20} />
        <H2 className='pb-0'>Defaults</H2>
      </View>

      <View className='flex gap-2'>
        <View className='flex-row items-center gap-1'>
          <Label>Coordinate Format</Label>
          <CoordFormatInfoButton />
        </View>
        <Text className='text-sm text-muted-foreground'>
          Default format when entering coordinates
        </Text>
        <ToggleGroup
          type='single'
          value={coordFormat}
          onValueChange={value => {
            if (value) setCoordFormat(value as CoordFormatDefault);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='DMS' className='flex-1'>
            <Text>DMS</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='DMM' className='flex-1'>
            <Text>DMM</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>

      <View className='flex gap-2'>
        <Label>Latitude Hemisphere</Label>
        <ToggleGroup
          type='single'
          value={hemisphereLatitude}
          onValueChange={value => {
            if (value) setHemisphereLatitude(value as HemisphereLatitude);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='N' className='flex-1'>
            <Text>North</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='S' className='flex-1'>
            <Text>South</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>

      <View className='flex gap-2'>
        <Label>Longitude Hemisphere</Label>
        <ToggleGroup
          type='single'
          value={hemisphereLongitude}
          onValueChange={value => {
            if (value) setHemisphereLongitude(value as HemisphereLongitude);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='E' className='flex-1'>
            <Text>East</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='W' className='flex-1'>
            <Text>West</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>

      <View className='flex gap-2'>
        <Label>Map Zoom</Label>
        <Text className='text-sm text-muted-foreground'>
          Latitude delta for the initial map view. Smaller values zoom in
          closer.
        </Text>
        <View className='flex-row gap-2 items-center'>
          <Input
            className='flex-1'
            keyboardType='numeric'
            value={mapZoomInput.value}
            onChangeText={mapZoomInput.onChangeText}
            onBlur={mapZoomInput.commit}
            placeholder='0.15'
          />
          <Button
            variant='ghost'
            size='icon'
            onPress={() => setMapZoom(DEFAULT_SETTINGS.mapZoom)}
            disabled={mapZoom === DEFAULT_SETTINGS.mapZoom}
          >
            <RefreshCw className='text-muted-foreground' size={18} />
          </Button>
        </View>
      </View>
    </View>
  );
}
