import { Link, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ItemList } from '~/components/ItemList';
import { Button, H2, Separator, Text } from '~/components/ui';
import {
  Course,
  CourseListItem,
  deleteCourse,
  useCourseGroup,
  useCourses,
} from '~/features/course';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus } from '~/lib/icons/Plus';

export default function CourseGroupDetailsPage() {
  const confirm = useConfirm();
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
    <View className='p-7 flex gap-5'>
      <View className='flex gap-2'>
        <H2>{courseGroupId === '-1' ? 'Ungrouped' : courseGroup?.name}</H2>
        {courseGroupId !== '-1' && (
          <View className='flex flex-row gap-2'>
            <Link
              href={{
                pathname: '/courses/new',
                params: {
                  courseGroupName: courseGroup?.name,
                  courseGroupId:
                    courseGroupId === '-1'
                      ? undefined
                      : courseGroupId.toString(),
                },
              }}
              push
              asChild
            >
              <Button className='flex flex-1 flex-row gap-2'>
                <Plus className='text-primary-foreground' />
                <Text>New Course</Text>
              </Button>
            </Link>
          </View>
        )}
      </View>
      <Separator />
      <ItemList<Course>
        items={coursesQuery.data}
        renderItem={course => (
          <CourseListItem
            course={course}
            onEdit={onCourseEdit}
            onDelete={onCourseDelete}
            onPress={onCoursePress}
          />
        )}
        noItemsMessage='No courses found'
      />
    </View>
  );
}
