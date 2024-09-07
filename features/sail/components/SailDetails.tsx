import { View } from 'react-native';
import { Badge, H3, Text } from '~/components/ui';
import { Sail } from '../model/sail';

interface SailDetailsProps {
  sail: Sail;
}

export function SailDetails({ sail }: SailDetailsProps) {
  return (
    <View className='flex gap-5'>
      <H3>Details</H3>
      <View className='flex flex-row gap-5'>
        <View className='flex flex-row gap-2 items-baseline flex-1'>
          <Text className='font-bold text-lg'>Colour:</Text>
          <Text>{sail.color}</Text>
        </View>
        <View className='flex flex-row gap-2 items-baseline flex-1'>
          <Text className='font-bold text-lg'>Sail Area:</Text>
          <Text>{sail.sailArea}</Text>
        </View>
      </View>
      <Badge variant='secondary'>
        <Text className='text-sm'>
          {sail.symmetrical ? 'Symmetrical' : 'Asymmetrical'}
        </Text>
      </Badge>
    </View>
  );
}
