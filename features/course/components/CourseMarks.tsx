import { useConfirm } from '~/hooks/useConfirm';
import { useCourseMarks } from '../api/getCourses';
import { Course } from '../model/course';
import { useState } from 'react';
import { deleteCourseMark } from '../api/deleteCourse';
import { View } from 'react-native';
import { Button, H3 } from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';
import { ItemList } from '~/components/ItemList';
import { CourseMark, CourseMarkWithMark } from '../model/courseMark';
import { CourseMarkListItem } from './CourseMarkListItem';

interface CourseMarksProps {
  course: Course;
}

export function CourseMarks({ course }: CourseMarksProps) {
  const confirm = useConfirm();
  const { data: courseMarks } = useCourseMarks(course.id);

  const [newCourseMarkDialogOpen, setNewCourseMarkDialogOpen] = useState(false);

  async function onCourseMarkDelete(courseMark: CourseMark) {
    const proceed = await confirm({
      title: 'Delete Course Mark',
      message: 'Are you sure you want to delete this course mark?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    await deleteCourseMark(courseMark.id);
  }

  async function handleNewCourseMark(data: any) {
    // Implement the logic to create a new course mark
    // This function should handle the form submission for creating a new course mark
    // You can use the data parameter to access the form values
    console.log('New Course Mark Data:', data);
  }

  return (
    <View className='flex gap-5'>
      <View className='flex flex-row gap-3 items-center justify-between'>
        <H3>Marks</H3>
        <Button
          variant='secondary'
          size='icon'
          onPress={() => setNewCourseMarkDialogOpen(true)}
        >
          <Plus className='text-foreground' size={18} />
        </Button>
      </View>
      <ItemList<CourseMarkWithMark>
        items={courseMarks}
        renderItem={courseMark => (
          <CourseMarkListItem
            courseMark={courseMark}
            onDelete={onCourseMarkDelete}
          />
        )}
        noItemsMessage='No marks found'
      />
      {/* <NewCourseMarkDialog
        open={newCourseMarkDialogOpen}
        onOpenChange={setNewCourseMarkDialogOpen}
        onFormSubmit={handleNewCourseMark}
      /> */}
    </View>
  );
}
