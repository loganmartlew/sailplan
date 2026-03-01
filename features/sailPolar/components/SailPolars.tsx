import { View, FlatList } from 'react-native';
import { Badge, Button, H3, Text } from '~/components/ui';
import { Sail } from '~/features/sail';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus } from '~/lib/icons';
import { useState } from 'react';
import { useSailPolars } from '../api/getSailPolars';
import { SailPolar } from '../model/sailPolar';
import { deleteSailPolar } from '../api/deleteSailPolar';
import {
  NewSailPolarDialog,
  SailPolarSubmitValues,
} from './NewSailPolarDialog';
import { createSailPolar } from '../api/createSailPolar';
import { SailPolarListItem } from './SailPolarListItem';

interface SailPolarsProps {
  sail: Sail;
}

export function SailPolars({ sail }: SailPolarsProps) {
  const confirm = useConfirm();
  const { data: sailPolars } = useSailPolars(sail.id);

  const [newPolarDialogOpen, setNewPolarDialogOpen] = useState(false);

  async function onSailPolarDelete(sailPolar: SailPolar) {
    const proceed = await confirm({
      title: 'Delete Polar',
      message: 'Are you sure you want to delete this polar?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteSailPolar(sailPolar.id);
  }

  async function handleNewPolar(data: SailPolarSubmitValues) {
    await createSailPolar({
      sailId: data.sailId,
      twa: data.twa,
      tws: data.tws,
      speed: data.speed,
    });
  }

  return (
    <View className='flex gap-5'>
      <View className='flex-row items-center justify-between'>
        <View className='flex-row items-center gap-2'>
          <H3>Polars</H3>
          {sailPolars?.length > 0 && (
            <Badge variant='transparent'>
              <Text className='text-xs'>
                {sailPolars.length} {sailPolars.length === 1 ? 'mark' : 'marks'}
              </Text>
            </Badge>
          )}
        </View>
        <Button
          variant='secondary'
          size='icon'
          onPress={() => setNewPolarDialogOpen(true)}
        >
          <Plus className='text-secondary-foreground' size={18} />
        </Button>
      </View>
      <FlatList
        data={sailPolars}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <SailPolarListItem sailPolar={item} onDelete={onSailPolarDelete} />
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-5'>
            <Text>No polars found</Text>
          </View>
        }
      />
      <NewSailPolarDialog
        sailId={sail.id}
        open={newPolarDialogOpen}
        onOpenChange={setNewPolarDialogOpen}
        onFormSubmit={handleNewPolar}
      />
    </View>
  );
}
