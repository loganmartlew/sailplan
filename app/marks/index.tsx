import { Link, router } from 'expo-router';
import { View, FlatList } from 'react-native';
import { Button, H2, Separator, Text } from '~/components/ui';
import {
  useMarks,
  Mark,
  MarkListItem,
  deleteMark,
  MarkShareDialog,
} from '~/features/mark';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus, MapPin, Share2 } from '~/lib/icons';
import { useState } from 'react';

export default function Marks() {
  const confirm = useConfirm();
  const marksQuery = useMarks();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const onMarkEdit = (mark: Mark) => {
    router.push({
      pathname: '/marks/[markId]',
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
          <Link href='/marks/map' push asChild>
            <Button
              size='sm'
              variant='secondary'
              className='flex flex-row gap-1'
            >
              <Text>View on map</Text>
              <MapPin className='text-secondary-foreground' size={15} />
            </Button>
          </Link>
        </View>
        <Link href='/marks/new' push asChild>
          <Button className='flex flex-row gap-2'>
            <Plus className='text-primary-foreground' />
            <Text>New Mark</Text>
          </Button>
        </Link>
        <Button
          className='flex flex-row gap-2'
          variant='secondary'
          onPress={() => setShareDialogOpen(true)}
        >
          <Share2 className='text-secondary-foreground' />
          <Text>Share</Text>
        </Button>
      </View>
      <Separator />
      <FlatList
        data={marksQuery.data}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <MarkListItem
            mark={item}
            onDelete={onMarkDelete}
            onEdit={onMarkEdit}
          />
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-5'>
            <Text>No marks found</Text>
          </View>
        }
      />
      <MarkShareDialog
        open={shareDialogOpen}
        onOpenChange={val => setShareDialogOpen(val)}
      />
    </View>
  );
}
