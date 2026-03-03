import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View, FlatList } from 'react-native';
import { Badge, Button, H2, Muted, Text } from '~/components/ui';
import { deleteSail, Sail, SailListItem, useSails } from '~/features/sail';
import { SailPolarImportDialog } from '~/features/sailPolar';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus, Sailboat, Share2 } from '~/lib/icons';

export default function Sails() {
  const confirm = useConfirm();
  const sailsQuery = useSails();
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const onSailPress = (sail: Sail) => {
    router.push({
      pathname: '/sails/[sailId]',
      params: { sailId: sail.id.toString() },
    });
  };

  const onSailEdit = (sail: Sail) => {
    router.push({
      pathname: '/sails/[sailId]',
      params: { sailId: sail.id.toString(), edit: 'true' },
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
    <View className='flex-1 w-full px-3 py-5 pb-0 flex flex-col gap-6'>
      <View className='flex gap-4'>
        <View className='flex-row items-center justify-between'>
          <H2 className='pb-0'>Sails</H2>
          {(sailsQuery?.data?.length ?? 0) > 0 && (
            <Badge variant='transparent'>
              <Text className='text-sm'>
                {sailsQuery!.data!.length}{' '}
                {sailsQuery!.data!.length === 1 ? 'sail' : 'sails'}
              </Text>
            </Badge>
          )}
        </View>
        <View className='flex-row gap-2'>
          <Link href='/sails/new' push asChild>
            <Button className='flex-1 flex-row gap-2'>
              <Plus className='text-primary-foreground' size={18} />
              <Text>New Sail</Text>
            </Button>
          </Link>
          <Button
            variant='secondary'
            className='flex-row gap-2'
            onPress={() => setImportDialogOpen(true)}
          >
            <Share2 className='text-secondary-foreground' size={18} />
          </Button>
        </View>
      </View>
      <FlatList
        data={sailsQuery?.data}
        keyExtractor={item => item.id.toString()}
        contentContainerClassName='gap-3'
        renderItem={({ item }) => (
          <SailListItem
            sail={item}
            onDelete={onSailDelete}
            onEdit={onSailEdit}
            onPress={onSailPress}
          />
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-10 gap-2'>
            <Sailboat className='text-muted-foreground' size={32} />
            <Muted>No sails yet</Muted>
          </View>
        }
      />
      <SailPolarImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        sails={sailsQuery?.data ?? []}
      />
    </View>
  );
}
