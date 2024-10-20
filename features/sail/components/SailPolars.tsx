import { View } from 'react-native';
import { Badge, H3, Text } from '~/components/ui';
import { Sail } from '../model/sail';
import {
  deleteSailPolar,
  SailPolar,
  useSailPolars,
} from '~/features/sailPolar';
import { ItemList } from '~/components/ItemList';
import { SailPolarListItem } from '~/features/sailPolar/components/SailPolarListItem';
import { useConfirm } from '~/hooks/useConfirm';

interface SailPolarsProps {
  sail: Sail;
}

export function SailPolars({ sail }: SailPolarsProps) {
  const confirm = useConfirm();
  const { data: sailPolars } = useSailPolars(sail.id);

  const onSailPolarDelete = async (sailPolar: SailPolar) => {
    const proceed = await confirm({
      title: 'Delete Polar',
      message: 'Are you sure you want to delete this polar?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteSailPolar(sailPolar.id);
  };

  return (
    <View className='flex gap-5'>
      <H3>Polars</H3>
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
    </View>
  );
}
