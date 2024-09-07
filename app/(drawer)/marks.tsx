import { Link } from 'expo-router';
import { View } from 'react-native';
import { ItemList } from '~/components/ItemList';
import { Button, H2, Separator, Text } from '~/components/ui';
import { useMarks, Mark, MarkListItem } from '~/features/mark';
import { Plus } from '~/lib/icons/Plus';

export default function Marks() {
  const marks = useMarks();

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
      <ItemList<Mark>
        items={marks?.data}
        renderItem={mark => <MarkListItem mark={mark} />}
        noItemsMessage='No marks found'
      />
    </View>
  );
}
