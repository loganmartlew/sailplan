import { Pressable, View } from 'react-native';
import { Course } from '../model/course';
import { Button, H3 } from '~/components/ui';
import { Pencil } from '~/lib/icons/Pencil';
import { Trash } from '~/lib/icons/Trash';

interface CourseListItemProps {
  course: Course;
  onEdit?: (course: Course) => void;
  onDelete?: (course: Course) => void;
  onPress?: (course: Course) => void;
}

export function CourseListItem({
  course,
  onEdit,
  onDelete,
  onPress,
}: CourseListItemProps) {
  const content = (
    <>
      <H3>{course.name}</H3>
      <View className='flex flex-row gap-1'>
        {onEdit && (
          <Button variant='ghost' size='icon' onPress={() => onEdit(course)}>
            <Pencil className='text-foreground' size={18} />
          </Button>
        )}
        {onDelete && (
          <Button variant='ghost' size='icon' onPress={() => onDelete(course)}>
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
          className='flex flex-row gap-3 justify-between'
          onPress={() => onPress(course)}
        >
          {content}
        </Pressable>
      ) : (
        <View className='flex flex-row gap-3 justify-between'>{content}</View>
      )}
    </>
  );
}
