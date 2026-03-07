import { View } from 'react-native';
import { H2, Label, Text } from '~/components/ui';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { useSettings } from '~/features/settings';
import type { SpeedUnit, AreaUnit, DistanceUnit } from '~/features/settings';

export default function UnitsSettings() {
  const {
    speedUnit,
    setSpeedUnit,
    areaUnit,
    setAreaUnit,
    distanceUnit,
    setDistanceUnit,
  } = useSettings();

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-8'>
      <H2 className='pb-0'>Units</H2>

      <View className='flex gap-2'>
        <Label>Speed</Label>
        <Text className='text-sm text-muted-foreground'>
          Used for wind speed and boat speed
        </Text>
        <ToggleGroup
          type='single'
          value={speedUnit}
          onValueChange={value => {
            if (value) setSpeedUnit(value as SpeedUnit);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='kn' className='flex-1'>
            <Text>kn</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='km/h' className='flex-1'>
            <Text>km/h</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='m/s' className='flex-1'>
            <Text>m/s</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='mi/h' className='flex-1'>
            <Text>mi/h</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>

      <View className='flex gap-2'>
        <Label>Area</Label>
        <Text className='text-sm text-muted-foreground'>
          Used for sail area
        </Text>
        <ToggleGroup
          type='single'
          value={areaUnit}
          onValueChange={value => {
            if (value) setAreaUnit(value as AreaUnit);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='m^2' className='flex-1'>
            <Text>Square metres</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='ft^2' className='flex-1'>
            <Text>Square feet</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>

      <View className='flex gap-2'>
        <Label>Distance</Label>
        <Text className='text-sm text-muted-foreground'>
          Used for leg distances
        </Text>
        <ToggleGroup
          type='single'
          value={distanceUnit}
          onValueChange={value => {
            if (value) setDistanceUnit(value as DistanceUnit);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='nm' className='flex-1'>
            <Text>Nautical miles</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='km' className='flex-1'>
            <Text>Kilometres</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='mi' className='flex-1'>
            <Text>Miles</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>
    </View>
  );
}
