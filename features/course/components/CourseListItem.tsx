import { Pressable, View } from 'react-native';
import { Course } from '../model/course';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import { MapPin, Pencil, Route, Trash } from '~/lib/icons';
import { useCourseMarks } from '../api/getCourses';

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
  const { data: courseMarks } = useCourseMarks(course.id);
  const markCount = courseMarks?.length ?? 0;
  const card = (
    <Card className='gap-1'>
      <CardHeader className='flex-row items-center justify-between pb-1'>
        <View className='flex-row items-center gap-2 shrink'>
          <View className='w-8 h-8 rounded-full bg-primary/10 items-center justify-center'>
            <Route className='text-primary' size={16} />
          </View>
          <CardTitle showBullet={false} className='text-foreground'>
            {course.name}
          </CardTitle>
        </View>
        <View className='flex-row gap-1'>
          {onEdit && (
            <Button variant='ghost' size='icon' onPress={() => onEdit(course)}>
              <Pencil className='text-muted-foreground' size={16} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant='ghost'
              size='icon'
              onPress={() => onDelete(course)}
            >
              <Trash className='text-destructive' size={16} />
            </Button>
          )}
        </View>
      </CardHeader>
      <CardContent>
        {markCount > 0 && (
          <Badge
            variant='transparent'
            className='self-start flex-row items-center gap-1'
          >
            <MapPin className='text-primary' size={12} />
            <Text className='text-xs'>
              {markCount} {markCount === 1 ? 'mark' : 'marks'}
            </Text>
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  if (onPress) {
    return <Pressable onPress={() => onPress(course)}>{card}</Pressable>;
  }

  return card;
}
