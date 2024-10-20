import { View } from 'react-native';
import { Badge, Button, H3, Text } from '~/components/ui';
import { Sail } from '../model/sail';
import {
  createSailPolar,
  deleteSailPolar,
  NewSailPolarDialog,
  SailPolar,
  SailPolarFormValues,
  SailPolarListItem,
  useSailPolars,
} from '~/features/sailPolar';
import { ItemList } from '~/components/ItemList';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus } from '~/lib/icons/Plus';
import { useState } from 'react';

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

  async function handleNewPolar(data: SailPolarFormValues) {
    await createSailPolar({
      sailId: sail.id,
      twa: data.twa,
      tws: data.tws,
      speed: data.speed,
    });
  }

  console.log(sailPolars);

  return (
    <View className='flex gap-5'>
      <View className='flex flex-row gap-3 items-center justify-between'>
        <H3>Polars</H3>
        <Button
          variant='secondary'
          size='icon'
          onPress={() => setNewPolarDialogOpen(true)}
        >
          <Plus className='text-foreground' size={18} />
        </Button>
      </View>
      <ItemList<SailPolar>
        items={sailPolars}
        renderItem={sailPolar => (
          <SailPolarListItem
            sailPolar={sailPolar}
            onDelete={onSailPolarDelete}
          />
        )}
        noItemsMessage='No polars found'
      />
      <NewSailPolarDialog
        open={newPolarDialogOpen}
        onOpenChange={setNewPolarDialogOpen}
        onFormSubmit={handleNewPolar}
      />
    </View>
  );
}
