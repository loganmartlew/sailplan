import { useConfirm } from '~/hooks/useConfirm';
import { useCourseMarks } from '../api/getCourses';
import { Course } from '../model/course';
import { useState } from 'react';
import { deleteCourseMark } from '../api/deleteCourse';
import { View } from 'react-native';
import { Button, H3 } from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';
import { ItemList } from '~/components/ItemList';
import {
  CourseMark,
  CourseMarkInsert,
  CourseMarkWithMark,
} from '../model/courseMark';
import { CourseMarkListItem } from './CourseMarkListItem';
import {
  CourseMarkFormValues,
  NewCourseMarkDialog,
} from './NewCourseMarkDialog';
import { useMutation } from '@tanstack/react-query';
import { createCourseMark } from '../api/createCourse';

interface CourseMarksProps {
  course: Course;
}

export function CourseMarks({ course }: CourseMarksProps) {
  const confirm = useConfirm();
  const { data: courseMarks } = useCourseMarks(course.id);

  const [newCourseMarkDialogOpen, setNewCourseMarkDialogOpen] = useState(false);

  const createCourseMarkMutation = useMutation({
    mutationFn: (data: Omit<CourseMarkInsert, 'order'>) =>
      createCourseMark(data),
  });

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

  async function handleNewCourseMark(data: CourseMarkFormValues) {
    const markId = data.mark.value ? parseInt(data.mark.value) : null;
    if (!markId) {
      console.error('Mark ID is required to create a new course mark');
      return;
    }

    const courseMarkInsert: Omit<CourseMarkInsert, 'order'> = {
      courseId: course.id,
      markId,
      direction: data.direction === 'none' ? null : data.direction,
    };

    await createCourseMarkMutation.mutateAsync(courseMarkInsert);
  }

  return (
    <View className='flex gap-5'>
      <View className='flex flex-row gap-3 items-center justify-between'>
        <H3>Marks</H3>
        <Button
          variant='secondary'
          size='icon'
          onPress={() => setNewCourseMarkDialogOpen(true)}
          disabled={createCourseMarkMutation.isPending}
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
      <NewCourseMarkDialog
        open={newCourseMarkDialogOpen}
        onOpenChange={setNewCourseMarkDialogOpen}
        onFormSubmit={handleNewCourseMark}
      />
    </View>
  );
}
