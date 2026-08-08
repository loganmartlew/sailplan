import { Button, Card, CardContent, CardTitle, Text } from '~/components/ui';
import { CourseMarkWithMark } from '../model/courseMark';
import { Pressable, View } from 'react-native';
import { GripVertical, Pencil, Trash } from '~/lib/icons';
import { cn } from '~/lib/utils';

interface CourseMarkListItemProps {
  courseMark: CourseMarkWithMark;
  onEdit?: (courseMark: CourseMarkWithMark) => void;
  onDelete?: (courseMark: CourseMarkWithMark) => void;
  onPress?: (courseMark: CourseMarkWithMark) => void;
  onDrag?: () => void;
}

export function CourseMarkListItem({
  courseMark,
  onEdit,
  onDelete,
  onPress,
  onDrag,
}: CourseMarkListItemProps) {
  let directionText: string | undefined;
  if (courseMark.direction === 'port') directionText = 'P';
  if (courseMark.direction === 'starboard') directionText = 'S';

  const card = (
    <Card className='gap-1'>
      <CardContent className='py-2 flex-row items-center justify-between'>
        <View className='flex-row items-center gap-2 shrink'>
          {onDrag && (
            <Pressable onLongPress={onDrag}>
              <GripVertical className='text-muted-foreground' size={18} />
            </Pressable>
          )}
          <CardTitle showBullet={false} className='text-foreground'>
            {courseMark.mark.name}
          </CardTitle>
          {directionText && (
            <Text
              className={cn('font-semibold', {
                'text-green-400': courseMark.direction === 'starboard',
                'text-red-400': courseMark.direction === 'port',
              })}
            >
              {directionText}
            </Text>
          )}
        </View>
        <View className='flex-row gap-1'>
          {onEdit && (
            <Button
              variant='ghost'
              size='icon'
              onPress={() => onEdit(courseMark)}
            >
              <Pencil className='text-muted-foreground' size={16} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant='ghost'
              size='icon'
              onPress={() => onDelete(courseMark)}
            >
              <Trash className='text-destructive' size={16} />
            </Button>
          )}
        </View>
      </CardContent>
    </Card>
  );

  if (onPress) {
    return <Pressable onPress={() => onPress(courseMark)}>{card}</Pressable>;
  }

  return card;
}
