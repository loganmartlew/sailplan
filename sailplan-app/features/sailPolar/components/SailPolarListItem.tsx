import { View } from 'react-native';
import { SailPolar } from '../model/sailPolar';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Text,
} from '~/components/ui';
import { Trash, Wind } from '~/lib/icons';
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
    <Card className='gap-1'>
      <CardHeader className='flex-row items-center justify-between pb-1'>
        <View className='flex-row items-center gap-2 shrink'>
          <View className='w-8 h-8 rounded-full bg-accent items-center justify-center'>
            <Wind className='text-accent-foreground' size={16} />
          </View>
          <CardTitle showBullet={false} className='text-foreground'>
            {formatAngle(sailPolar.twa)} / {formatSpeed(sailPolar.tws)}
          </CardTitle>
        </View>
        <View className='flex-row gap-1'>
          {onDelete && (
            <Button
              variant='ghost'
              size='icon'
              onPress={() => onDelete(sailPolar)}
            >
              <Trash className='text-destructive' size={16} />
            </Button>
          )}
        </View>
      </CardHeader>
      <CardContent className='flex-row gap-2'>
        <View className='flex gap-1 w-16'>
          <Label className='text-xs'>TWA</Label>
          <Text className='text-base font-semibold'>
            {formatAngle(sailPolar.twa)}
          </Text>
        </View>
        <View className='flex gap-1 w-20'>
          <Label className='text-xs'>TWS</Label>
          <Text className='text-base font-semibold'>
            {formatSpeed(sailPolar.tws)}
          </Text>
        </View>
        <View className='flex gap-1 w-20'>
          <Label className='text-xs'>Speed</Label>
          <Text className='text-base font-semibold'>
            {formatSpeed(sailPolar.speed)}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
