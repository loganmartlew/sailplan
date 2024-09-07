import { Link } from 'expo-router';
import { Alert, View } from 'react-native';
import { ItemList } from '~/components/ItemList';
import { Button, H2, Separator, Text } from '~/components/ui';
import { useMarks, Mark, MarkListItem } from '~/features/mark';
import { deleteMark } from '~/features/mark/api/deleteMark';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus } from '~/lib/icons/Plus';

export default function Marks() {
  const confirm = useConfirm();
  const marks = useMarks();

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
        renderItem={mark => (
          <MarkListItem mark={mark} onDelete={onMarkDelete} />
        )}
        noItemsMessage='No marks found'
      />
    </View>
  );
}
