import { Link } from 'expo-router';
import { View } from 'react-native';
import { Button, H2, Separator, Text } from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';

export default function Marks() {
  return (
    <View className='p-7 flex gap-5'>
      <View className='flex gap-2'>
        <H2>Marks</H2>
        <Link href='/marks/new' asChild>
          <Button className='flex flex-row gap-2'>
            <Plus className='text-primary-foreground' />
            <Text>New Mark</Text>
          </Button>
        </Link>
      </View>
      <Separator />
    </View>
  );
}
