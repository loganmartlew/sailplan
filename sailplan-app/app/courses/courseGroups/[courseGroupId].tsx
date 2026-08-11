import { Link, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View, FlatList } from 'react-native';
import { Badge, Button, H2, Muted, Text } from '~/components/ui';
import {
  Course,
  CourseListItem,
  deleteCourse,
  useCourseGroup,
  useCourses,
} from '~/features/course';
import { useConfirm } from '~/hooks/useConfirm';
import { useCaptureInset } from '~/features/capture';
import { Plus, Route } from '~/lib/icons';

export default function CourseGroupDetailsPage() {
  const confirm = useConfirm();
  const captureInset = useCaptureInset();
  const { courseGroupId } = useLocalSearchParams<{
    courseGroupId: string;
  }>();

  const { data: courseGroup } = useCourseGroup(parseInt(courseGroupId));

  const coursesQuery = useCourses({
    courseGroupId: courseGroupId === '-1' ? null : parseInt(courseGroupId),
  });

  const onCoursePress = (course: Course) => {
    router.push({
      pathname: '/courses/[courseId]',
      params: { courseId: course.id.toString() },
    });
  };

  const onCourseEdit = (course: Course) => {
    router.push({
      pathname: '/courses/[courseId]',
      params: { courseId: course.id.toString(), edit: 'true' },
    });
  };

  const onCourseDelete = async (course: Course) => {
    const proceed = await confirm({
      title: 'Delete Course',
      message: `Are you sure you want to delete ${course.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteCourse(course.id);
  };

  if (!courseGroup && courseGroupId !== '-1') {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className='flex-1 w-full px-3 py-5 pb-0 flex flex-col gap-6'>
      <View className='flex gap-4'>
        <View className='flex-row items-center justify-between'>
          <H2 className='pb-0'>
            {courseGroupId === '-1' ? 'Ungrouped' : courseGroup?.name}
          </H2>
          {coursesQuery.data?.length > 0 && (
            <Badge variant='transparent'>
              <Text className='text-sm'>
                {coursesQuery.data.length}{' '}
                {coursesQuery.data.length === 1 ? 'course' : 'courses'}
              </Text>
            </Badge>
          )}
        </View>
        {courseGroupId !== '-1' && (
          <Link
            href={{
              pathname: '/courses/new',
              params: {
                courseGroupName: courseGroup?.name,
                courseGroupId:
                  courseGroupId === '-1' ? undefined : courseGroupId.toString(),
              },
            }}
            push
            asChild
          >
            <Button className='flex-row gap-2'>
              <Plus className='text-primary-foreground' size={18} />
              <Text>New Course</Text>
            </Button>
          </Link>
        )}
      </View>
      <FlatList
        data={coursesQuery.data}
        keyExtractor={item => item.id.toString()}
        contentContainerClassName='gap-3'
        contentContainerStyle={{ paddingBottom: captureInset }}
        renderItem={({ item }) => (
          <CourseListItem
            course={item}
            onEdit={onCourseEdit}
            onDelete={onCourseDelete}
            onPress={onCoursePress}
          />
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-10 gap-2'>
            <Route className='text-muted-foreground' size={32} />
            <Muted>No courses yet</Muted>
          </View>
        }
      />
    </View>
  );
}
