import { View } from 'react-native';
import { SailPolar } from '../model/sailPolar';
import { Button, Text } from '~/components/ui';
import { Trash } from '~/lib/icons/Trash';
import { formatAngle, formatSpeed } from '~/lib/format';

interface SailPolarListItemProps {
  sailPolar: SailPolar;
  onDelete?: (sail: SailPolar) => void;
}

export function SailPolarListItem({
  sailPolar,
  onDelete,
}: SailPolarListItemProps) {
  return (
    <View className='flex flex-row gap-3 justify-between'>
      <View>
        <Text>TWA: {formatAngle(sailPolar.twa)}</Text>
        <Text>TWS: {formatSpeed(sailPolar.tws)}</Text>
      </View>
      <View>
        <Text>Boat Speed: {formatSpeed(sailPolar.speed)}</Text>
      </View>
      <View className='flex flex-row gap-1'>
        {onDelete && (
          <Button
            variant='ghost'
            size='icon'
            onPress={() => onDelete(sailPolar)}
          >
            <Trash className='text-destructive' size={18} />
          </Button>
        )}
      </View>
    </View>
  );
}
