import { View } from 'react-native';
import { H2, Input } from '~/components/ui';

export default function Index() {
  return (
    <View className='flex-1 justify-center items-center'>
      <View className='w-full px-10 py-5 flex flex-col gap-2'>
        <H2 className='text-center'>Find a Sail</H2>
        <Input placeholder='10' />
        <Input placeholder='150' />
      </View>
    </View>
  );
}
