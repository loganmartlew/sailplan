import { Pressable, View } from 'react-native';
import { Button, H3, Text } from '~/components/ui';
import { Trash } from '~/lib/icons/Trash';
import { CourseGroupWithCourses } from '../model/courseGroup';
import { useState } from 'react';
import { getCourses } from '../api/getCourses';
import { useFocusEffect } from 'expo-router';

interface CourseGroupListItemProps {
  courseGroup: CourseGroupWithCourses;
  onDelete?: (courseGroup: CourseGroupWithCourses) => void;
  onPress?: (courseGroup: CourseGroupWithCourses) => void;
}

export function CourseGroupListItem({
  courseGroup,
  onDelete,
  onPress,
}: CourseGroupListItemProps) {
  const [count, setCount] = useState(courseGroup.courses.length);

  useFocusEffect(() => {
    getCourses({
      courseGroupId: courseGroup.id === -1 ? undefined : courseGroup.id,
    }).then(courses => {
      setCount(courses.length);
    });
  });

  const content = (
    <>
      <View className='flex gap-1'>
        <H3>{courseGroup.name}</H3>
        <Text className='text-muted-foreground'>
          {count} course
          {count !== 1 ? 's' : ''}
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
    </>
  );
  return (
    <>
      {onPress ? (
        <Pressable
          className='flex flex-row gap-3 justify-between items-center'
          onPress={() => onPress(courseGroup)}
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
