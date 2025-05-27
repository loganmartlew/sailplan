import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { ItemList } from '~/components/ItemList';
import { Button, H2, Separator, Text } from '~/components/ui';
import { useMarks, Mark, MarkListItem, deleteMark } from '~/features/mark';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus } from '~/lib/icons/Plus';
import { MapPin } from '~/lib/icons/MapPin';

export default function Marks() {
  const confirm = useConfirm();
  const marksQuery = useMarks();

  const onMarkEdit = (mark: Mark) => {
    router.navigate({
      pathname: '/(stack)/marks/[markId]',
      params: { markId: mark.id.toString() },
    });
  };

  const onMarkDelete = async (mark: Mark) => {
    const proceed = await confirm({
      title: 'Delete Mark',
      message: `Are you sure you want to delete ${mark.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteMark(mark.id);
  };

  return (
    <View className='p-7 flex gap-5'>
      <View className='flex gap-2'>
        <View className='flex flex-row justify-between gap-2'>
          <H2>Marks</H2>
          <Button size='sm' variant='secondary' className='flex flex-row gap-1'>
            <Text>View on map</Text>
            <MapPin className='text-secondary-foreground' size={15} />
          </Button>
        </View>
        <Link href='/marks/new' asChild>
          <Button className='flex flex-row gap-2'>
            <Plus className='text-primary-foreground' />
            <Text>New Mark</Text>
          </Button>
        </Link>
      </View>
      <Separator />
      <ItemList<Mark>
        items={marksQuery?.data}
        renderItem={mark => (
          <MarkListItem
            mark={mark}
            onDelete={onMarkDelete}
            onEdit={onMarkEdit}
          />
        )}
        noItemsMessage='No marks found'
      />
    </View>
  );
}
