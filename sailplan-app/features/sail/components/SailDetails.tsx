import { View } from 'react-native';
import { Badge, Label, Text } from '~/components/ui';
import { Sail } from '../model/sail';
import { formatArea } from '~/lib/format';
import { useSettings } from '~/features/settings';

interface SailDetailsProps {
  sail: Sail;
}

export function SailDetails({ sail }: SailDetailsProps) {
  const { areaUnit } = useSettings();

  return (
    <View className='flex-row items-center gap-3 flex-wrap'>
      <View className='flex-row items-center gap-3'>
        <View
          className='w-8 h-8 rounded-full'
          style={{ backgroundColor: sail.color?.toLowerCase() || '#888' }}
        />
        <View>
          <Label className='text-xs'>Colour</Label>
          <Text className='text-base uppercase'>{sail.color || '—'}</Text>
        </View>
      </View>
      <Badge
        variant='transparent'
        className='flex-row items-center gap-1 py-1.5 px-3'
      >
        <Text className='text-sm'>
          {sail.symmetrical ? 'Symmetrical' : 'Asymmetrical'}
        </Text>
      </Badge>
      <Badge
        variant='transparent'
        className='flex-row items-center gap-1 py-1.5 px-3'
      >
        <Text className='text-sm'>
          {sail.masthead ? 'Masthead' : 'Fractional'}
        </Text>
      </Badge>
      {sail.sailArea != null && sail.sailArea > 0 && (
        <Badge
          variant='transparent'
          className='flex-row items-center gap-1 py-1.5 px-3'
        >
          <Text className='text-sm'>{formatArea(sail.sailArea, areaUnit)}</Text>
        </Badge>
      )}
    </View>
  );
}
