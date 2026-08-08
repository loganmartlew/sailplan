import { View } from 'react-native';
import { Mark } from '../model/mark';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Text,
} from '~/components/ui';
import { MapPin, Pencil, Trash } from '~/lib/icons';

interface MarkListItemProps {
  mark: Mark;
  onEdit?: (mark: Mark) => void;
  onDelete?: (mark: Mark) => void;
}

function formatCoord(value: number, type: 'lat' | 'lng'): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(3);
  const dir =
    type === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${deg}° ${min}' ${dir}`;
}

export function MarkListItem({ mark, onEdit, onDelete }: MarkListItemProps) {
  return (
    <Card className='gap-1'>
      <CardHeader className='pb-2 flex-row items-center justify-between'>
        <View className='flex-row items-center gap-2 shrink'>
          <View className='w-8 h-8 rounded-full bg-accent items-center justify-center'>
            <MapPin className='text-accent-foreground' size={16} />
          </View>
          <CardTitle showBullet={false} className='text-foreground'>
            {mark.name}
          </CardTitle>
        </View>
        <View className='flex-row gap-1'>
          {onEdit && (
            <Button variant='ghost' size='icon' onPress={() => onEdit(mark)}>
              <Pencil className='text-muted-foreground' size={16} />
            </Button>
          )}
          {onDelete && (
            <Button variant='ghost' size='icon' onPress={() => onDelete(mark)}>
              <Trash className='text-destructive' size={16} />
            </Button>
          )}
        </View>
      </CardHeader>
      <CardContent className='flex-row gap-6'>
        <View className='flex gap-1'>
          <Label className='text-xs'>Lat</Label>
          <Text className='text-base font-semibold'>
            {formatCoord(mark.latitude, 'lat')}
          </Text>
        </View>
        <View className='flex gap-1'>
          <Label className='text-xs'>Lng</Label>
          <Text className='text-base font-semibold'>
            {formatCoord(mark.longitude, 'lng')}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}
