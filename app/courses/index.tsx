import { Link } from 'expo-router';
import { View } from 'react-native';
import { Button, H2, Separator, Text } from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';
import {
  CourseGroup,
  CourseGroupListItem,
  deleteCourseGroup,
  useCourseGroups,
  useCourses,
} from '~/features/course';
import { ItemList } from '~/components/ItemList';
import { useAlert } from '~/hooks/useAlert';
import { useMemo } from 'react';

export default function Courses() {
  const alert = useAlert();
  const courseGroupsQuery = useCourseGroups();
  const ungroupedCoursesQuery = useCourses({ courseGroupId: null });

  const onCourseGroupDelete = async (courseGroup: CourseGroup) => {
    if (courseGroup.courseCount > 0) {
    }

    const proceed = await alert({
      title: 'Cannot Delete Course Group',
      message: `Course group "${courseGroup.name}" has existing courses. Please delete the courses first.`,
      confirmText: 'Ok',
    });

    if (!proceed) return;

    await deleteCourseGroup(courseGroup.id);
  };

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

  return (
    <View className='p-7 flex gap-5'>
      <View className='flex gap-2'>
        <H2>Courses</H2>
        <View className='flex flex-row gap-2'>
          {/* <Link href='/courses/new' push asChild> */}
          <Button className='flex flex-1 flex-row gap-2' variant='secondary'>
            <Plus className='text-secondary-foreground' />
            <Text>New Group</Text>
          </Button>
          {/* </Link> */}
          {/* <Link href='/courses/new' push asChild> */}
          <Button className='flex flex-1 flex-row gap-2'>
            <Plus className='text-primary-foreground' />
            <Text>New Course</Text>
          </Button>
          {/* </Link> */}
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
    </View>
  );
}
