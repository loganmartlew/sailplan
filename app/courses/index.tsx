import { Link } from 'expo-router';
import { View } from 'react-native';
import { Button, H2, Separator, Text } from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';
import {
  CourseGroup,
  CourseGroupInsert,
  CourseGroupListItem,
  createCourseGroup,
  deleteCourseGroup,
  NewCourseGroupDialog,
  useCourseGroups,
  useCourses,
} from '~/features/course';
import { ItemList } from '~/components/ItemList';
import { useAlert } from '~/hooks/useAlert';
import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';

export default function Courses() {
  const alert = useAlert();
  const confirm = useConfirm();
  const courseGroupsQuery = useCourseGroups();
  const ungroupedCoursesQuery = useCourses({ courseGroupId: null });

  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);

  const onCourseGroupDelete = async (courseGroup: CourseGroup) => {
    let proceed = true;

    if (courseGroup.courseCount > 0) {
      proceed = await alert({
        title: 'Cannot Delete Course Group',
        message: `Course group "${courseGroup.name}" has existing courses. Please delete the courses first.`,
        confirmText: 'Ok',
      });
    }

    if (proceed) {
      proceed = await confirm({
        title: 'Delete Course Group',
        message: `Are you sure you want to delete ${courseGroup.name}?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        destructive: true,
      });
    }

    if (!proceed) return;

    await deleteCourseGroup(courseGroup.id);
  };

  const courseGroupMutation = useMutation({
    mutationFn: (courseGroup: CourseGroupInsert) =>
      createCourseGroup(courseGroup),
  });

  const courseGroups = useMemo(() => {
    const courseGroups = courseGroupsQuery?.data || [];

    if (ungroupedCoursesQuery?.data?.length > 0) {
      courseGroups.push({
        id: 0,
        name: 'Ungrouped Courses',
        courseCount: ungroupedCoursesQuery.data.length,
      } as CourseGroup);
    }

    return courseGroups;
  }, [courseGroupsQuery?.data, ungroupedCoursesQuery?.data]);

  console.log(courseGroups);

  return (
    <View className='p-7 flex gap-5'>
      <View className='flex gap-2'>
        <H2>Courses</H2>
        <View className='flex flex-row gap-2'>
          <Button
            className='flex flex-1 flex-row gap-2'
            variant='secondary'
            disabled={courseGroupMutation.isPending}
            onPress={() => setNewGroupDialogOpen(true)}
          >
            <Plus className='text-secondary-foreground' />
            <Text>New Group</Text>
          </Button>
          <Link href='/courses/new' push asChild>
            <Button className='flex flex-1 flex-row gap-2'>
              <Plus className='text-primary-foreground' />
              <Text>New Course</Text>
            </Button>
          </Link>
        </View>
      </View>
      <Separator />
      <ItemList<CourseGroup>
        items={courseGroups}
        renderItem={courseGroup => (
          <CourseGroupListItem
            courseGroup={courseGroup}
            onDelete={onCourseGroupDelete}
          />
        )}
        noItemsMessage='No course groups found'
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
