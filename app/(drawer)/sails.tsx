import { Link, router } from 'expo-router';
import { View } from 'react-native';
import { ItemList } from '~/components/ItemList';
import { Button, H2, Separator, Text } from '~/components/ui';
import { deleteSail, Sail, SailListItem, useSails } from '~/features/sail';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus } from '~/lib/icons/Plus';

export default function Sails() {
  const confirm = useConfirm();
  const sailsQuery = useSails();

  const onSailEdit = (sail: Sail) => {
    router.navigate({
      pathname: '/(stack)/sails/[sailId]',
      params: { sailId: sail.id.toString() },
    });
  };

  const onSailDelete = async (sail: Sail) => {
    const proceed = await confirm({
      title: 'Delete Sail',
      message: `Are you sure you want to delete ${sail.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteSail(sail.id);
  };

  return (
    <View className='p-7 flex gap-5'>
      <View className='flex gap-2'>
        <H2>Sails</H2>
        <Link href='/sails/new' asChild>
          <Button className='flex flex-row gap-2'>
            <Plus className='text-primary-foreground' />
            <Text>New Sail</Text>
          </Button>
        </Link>
      </View>
      <Separator />
      <ItemList<Sail>
        items={sailsQuery?.data}
        renderItem={sail => (
          <SailListItem
            sail={sail}
            onDelete={onSailDelete}
            onEdit={onSailEdit}
          />
        )}
        noItemsMessage='No sails found'
      />
    </View>
  );
}
