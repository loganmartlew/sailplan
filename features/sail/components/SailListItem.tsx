import { Pressable, View } from 'react-native';
import { Sail } from '../model/sail';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { Pencil, Trash } from '~/lib/icons';

interface SailListItemProps {
  sail: Sail;
  onEdit?: (sail: Sail) => void;
  onDelete?: (sail: Sail) => void;
  onPress?: (sail: Sail) => void;
}

export function SailListItem({
  sail,
  onEdit,
  onDelete,
  onPress,
}: SailListItemProps) {
  const card = (
    <Card className='gap-1'>
      <CardHeader className='flex-row items-center justify-between pb-1'>
        <View className='flex-row items-center gap-2 shrink'>
          <View
            className='w-5 h-5 rounded-full items-center justify-center'
            style={{ backgroundColor: sail.color.toLowerCase() || '#888' }}
          />
          <CardTitle showBullet={false} className='text-foreground'>
            {sail.name}
          </CardTitle>
        </View>
        <View className='flex-row gap-1'>
          {onEdit && (
            <Button variant='ghost' size='icon' onPress={() => onEdit(sail)}>
              <Pencil className='text-muted-foreground' size={16} />
            </Button>
          )}
          {onDelete && (
            <Button variant='ghost' size='icon' onPress={() => onDelete(sail)}>
              <Trash className='text-destructive' size={16} />
            </Button>
          )}
        </View>
      </CardHeader>
      <CardContent className='flex-row items-center gap-2'>
        <Badge variant='transparent' className='flex-row items-center gap-1'>
          <Text className='text-xs'>
            {sail.symmetrical ? 'Symmetrical' : 'Asymmetrical'}
          </Text>
        </Badge>
        <Badge variant='transparent' className='flex-row items-center gap-1'>
          <Text className='text-xs'>
            {sail.masthead ? 'Masthead' : 'Fractional'}
          </Text>
        </Badge>
        {sail.sailArea != null && sail.sailArea > 0 && (
          <Badge variant='transparent' className='flex-row items-center gap-1'>
            <Text className='text-xs'>{sail.sailArea} m²</Text>
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  if (onPress) {
    return <Pressable onPress={() => onPress(sail)}>{card}</Pressable>;
  }

  return card;
}
