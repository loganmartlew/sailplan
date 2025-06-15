import { View } from 'react-native';
import { Button, H3, Text } from '~/components/ui';
import { Trash } from '~/lib/icons/Trash';
import { CourseGroup } from '../model/courseGroup';

interface CourseGroupListItemProps {
  courseGroup: CourseGroup;
  onDelete?: (courseGroup: CourseGroup) => void;
}

export function CourseGroupListItem({
  courseGroup,
  onDelete,
}: CourseGroupListItemProps) {
  return (
    <View className='flex flex-row gap-3 justify-between'>
      <View className='flex flex-row gap-2'>
        <H3>{courseGroup.name}</H3>
        <Text className='text-muted-foreground'>
          {courseGroup.courseCount} course
          {courseGroup.courseCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <View className='flex flex-row gap-1'>
        {onDelete && (
          <Button
            variant='ghost'
            size='icon'
            onPress={() => onDelete(courseGroup)}
          >
            <Trash className='text-destructive' size={18} />
          </Button>
        )}
      </View>
    </View>
  );
}
