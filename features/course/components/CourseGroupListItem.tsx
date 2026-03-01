import { Pressable, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { Folder, Route, Trash } from '~/lib/icons';
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
      setCount(
        courses.filter(
          course =>
            course.courseGroupId === courseGroup.id ||
            (courseGroup.id === -1 && course.courseGroupId === null),
        ).length,
      );
    });
  });

  const card = (
    <Card className='gap-1'>
      <CardHeader className='flex-row items-center justify-between pb-1'>
        <View className='flex-row items-center gap-2 shrink'>
          <View className='w-8 h-8 rounded-full bg-accent items-center justify-center'>
            <Folder className='text-accent-foreground' size={16} />
          </View>
          <CardTitle showBullet={false} className='text-foreground'>
            {courseGroup.name}
          </CardTitle>
        </View>
        <View className='flex-row gap-1'>
          {onDelete && (
            <Button
              variant='ghost'
              size='icon'
              onPress={() => onDelete(courseGroup)}
            >
              <Trash className='text-destructive' size={16} />
            </Button>
          )}
        </View>
      </CardHeader>
      <CardContent>
        <Badge
          variant='transparent'
          className='self-start flex-row items-center gap-1'
        >
          <Route className='text-primary' size={12} />
          <Text className='text-xs'>
            {count} {count === 1 ? 'course' : 'courses'}
          </Text>
        </Badge>
      </CardContent>
    </Card>
  );

  if (onPress) {
    return <Pressable onPress={() => onPress(courseGroup)}>{card}</Pressable>;
  }

  return card;
}
