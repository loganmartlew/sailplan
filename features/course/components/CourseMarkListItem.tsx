import { Button, H3 } from '~/components/ui';
import { CourseMarkWithMark } from '../model/courseMark';
import { Pressable, View } from 'react-native';
import { Pencil } from '~/lib/icons/Pencil';
import { Trash } from '~/lib/icons/Trash';
import { cn } from '~/lib/utils';

interface CourseMarkListItemProps {
  courseMark: CourseMarkWithMark;
  onEdit?: (courseMark: CourseMarkWithMark) => void;
  onDelete?: (courseMark: CourseMarkWithMark) => void;
  onPress?: (courseMark: CourseMarkWithMark) => void;
}

export function CourseMarkListItem({
  courseMark,
  onEdit,
  onDelete,
  onPress,
}: CourseMarkListItemProps) {
  let directionText: string | undefined;
  if (courseMark.direction === 'port') directionText = 'P';
  if (courseMark.direction === 'starboard') directionText = 'S';

  const content = (
    <>
      <View className='flex flex-row gap-1'>
        <H3>{courseMark.mark.name}</H3>
        {directionText && (
          <H3
            className={cn({
              'text-green-400': courseMark.direction === 'starboard',
              'text-red-400': courseMark.direction === 'port',
            })}
          >
            {directionText}
          </H3>
        )}
      </View>
      <View className='flex flex-row gap-1'>
        {onEdit && (
          <Button
            variant='ghost'
            size='icon'
            onPress={() => onEdit(courseMark)}
          >
            <Pencil className='text-foreground' size={18} />
          </Button>
        )}
        {onDelete && (
          <Button
            variant='ghost'
            size='icon'
            onPress={() => onDelete(courseMark)}
          >
            <Trash className='text-destructive' size={18} />
          </Button>
        )}
      </View>
    </>
  );

  return (
    <>
      {onPress ? (
        <Pressable
          className='flex flex-row gap-3 justify-between items-center'
          onPress={() => onPress(courseMark)}
        >
          {content}
        </Pressable>
      ) : (
        <View className='flex flex-row gap-3 justify-between items-center'>
          {content}
        </View>
      )}
    </>
  );
}
