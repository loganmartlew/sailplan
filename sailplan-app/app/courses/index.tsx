import { Link, router } from 'expo-router';
import { View, FlatList } from 'react-native';
import { Badge, Button, H2, Muted, Separator, Text } from '~/components/ui';
import { Plus, Route } from '~/lib/icons';
import {
  Course,
  CourseGroupInsert,
  CourseGroupListItem,
  CourseGroupWithCourses,
  CourseListItem,
  createCourseGroup,
  deleteCourse,
  deleteCourseGroup,
  getCourses,
  NewCourseGroupDialog,
  useCourseGroups,
  useCourses,
} from '~/features/course';
import { useAlert } from '~/hooks/useAlert';
import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { useCaptureInset } from '~/features/capture';

type ListItem =
  | { type: 'group'; data: CourseGroupWithCourses }
  | { type: 'course'; data: Course }
  | { type: 'separator' };

export default function Courses() {
  const alert = useAlert();
  const confirm = useConfirm();
  const courseGroupsQuery = useCourseGroups();
  const coursesQuery = useCourses();
  const captureInset = useCaptureInset();

  const ungroupedCourses =
    coursesQuery.data?.filter(course => course.courseGroupId === null) ?? [];

  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);

  const onCourseGroupPress = (courseGroup: CourseGroupWithCourses) => {
    router.push({
      pathname: '/courses/courseGroups/[courseGroupId]',
      params: { courseGroupId: courseGroup.id.toString() },
    });
  };

  const onCourseGroupDelete = async (courseGroup: CourseGroupWithCourses) => {
    const courses = await getCourses({ courseGroupId: courseGroup.id });

    if (courses.length > 0) {
      await alert({
        title: 'Cannot Delete Course Group',
        message: `Course group "${courseGroup.name}" has existing courses. Please delete the courses first.`,
        confirmText: 'Ok',
      });
      return;
    }
    const proceed = await confirm({
      title: 'Delete Course Group',
      message: `Are you sure you want to delete ${courseGroup.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteCourseGroup(courseGroup.id);
  };

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

  const courseGroupMutation = useMutation({
    mutationFn: (courseGroup: CourseGroupInsert) =>
      createCourseGroup(courseGroup),
  });

  const listItems = useMemo(() => {
    const items: ListItem[] = (courseGroupsQuery?.data ?? []).map(group => ({
      type: 'group' as const,
      data: group,
    }));

    const ungrouped = ungroupedCourses;
    if (ungrouped.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'separator' as const });
      }
      ungrouped.forEach(course => {
        items.push({ type: 'course' as const, data: course });
      });
    }

    return items;
  }, [courseGroupsQuery?.data, ungroupedCourses]);

  return (
    <View className='flex-1 w-full px-3 py-5 pb-0 flex flex-col gap-6'>
      <View className='flex gap-4'>
        <View className='flex-row items-center justify-between'>
          <H2 className='pb-0'>Courses</H2>
          <Badge variant='transparent'>
            <Text className='text-sm'>
              {coursesQuery.data?.length ?? 0}{' '}
              {coursesQuery.data?.length === 1 ? 'course' : 'courses'}
            </Text>
          </Badge>
        </View>
        <View className='flex-row gap-2'>
          <Button
            className='flex-1 flex-row gap-2'
            variant='secondary'
            disabled={courseGroupMutation.isPending}
            onPress={() => setNewGroupDialogOpen(true)}
          >
            <Plus className='text-secondary-foreground' size={18} />
            <Text>New Group</Text>
          </Button>
          <Link href='/courses/new' push asChild>
            <Button className='flex-1 flex-row gap-2'>
              <Plus className='text-primary-foreground' size={18} />
              <Text>New Course</Text>
            </Button>
          </Link>
        </View>
      </View>
      <FlatList
        data={listItems}
        keyExtractor={(item, index) =>
          item.type === 'separator'
            ? `sep-${index}`
            : item.type === 'group'
              ? `group-${item.data.id}`
              : `course-${item.data.id}`
        }
        contentContainerClassName='gap-3'
        contentContainerStyle={{ paddingBottom: captureInset }}
        renderItem={({ item }) => {
          if (item.type === 'separator') {
            return <Separator className='my-1' />;
          }
          if (item.type === 'group') {
            return (
              <CourseGroupListItem
                courseGroup={item.data}
                onDelete={onCourseGroupDelete}
                onPress={onCourseGroupPress}
              />
            );
          }
          return (
            <CourseListItem
              course={item.data}
              onEdit={onCourseEdit}
              onDelete={onCourseDelete}
              onPress={onCoursePress}
            />
          );
        }}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-10 gap-2'>
            <Route className='text-muted-foreground' size={32} />
            <Muted>No courses yet</Muted>
          </View>
        }
      />
      <NewCourseGroupDialog
        open={newGroupDialogOpen}
        onOpenChange={setNewGroupDialogOpen}
        onFormSubmit={data => {
          courseGroupMutation.mutate(data);
          setNewGroupDialogOpen(false);
        }}
      />
    </View>
  );
}
