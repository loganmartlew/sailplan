import { useConfirm } from '~/hooks/useConfirm';
import { useCourseMarks } from '../api/getCourses';
import { Course } from '../model/course';
import { useState } from 'react';
import { deleteCourseMark } from '../api/deleteCourse';
import { Pressable, View } from 'react-native';
import { Button, H3, Text } from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';
import { GripVertical } from '~/lib/icons/GripVertical';
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
import { updateCourseMark } from '../api/updateCourse';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { cn } from '~/lib/utils';

interface CourseMarksProps {
  course: Course;
}

export function CourseMarks({ course }: CourseMarksProps) {
  const confirm = useConfirm();
  const { data: courseMarks } = useCourseMarks(course.id);

  const [newCourseMarkDialogOpen, setNewCourseMarkDialogOpen] = useState(false);
  const [courseMarkToEdit, setCourseMarkToEdit] =
    useState<CourseMarkFormValues | null>(null);

  const createCourseMarkMutation = useMutation({
    mutationFn: (data: Omit<CourseMarkInsert, 'order'>) =>
      createCourseMark(data),
  });

  const updateCourseMarkMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CourseMarkInsert>;
    }) => updateCourseMark(id, data),
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

  async function onCourseMarkEdit(courseMark: CourseMarkWithMark) {
    setCourseMarkToEdit({
      courseMarkId: courseMark.id,
      mark: {
        label: courseMark.mark.name,
        value: courseMark.mark.id.toString(),
      },
      direction: (courseMark.direction as 'port' | 'starboard') || 'none',
    });
    setNewCourseMarkDialogOpen(true);
  }

  async function onReorderCourseMarks(params: { from: number; to: number }) {
    const { from, to } = params;
    const marks = [...courseMarks];

    const movedItem = marks[from];
    const remainingItems = marks.filter((_, index) => index !== from);

    const reorderedItems = [
      ...remainingItems.slice(0, to),
      movedItem,
      ...remainingItems.slice(to),
    ];

    await Promise.all(
      reorderedItems.map((mark, index) =>
        updateCourseMarkMutation.mutateAsync({
          id: mark.id,
          data: { order: index },
        })
      )
    );
  }

  async function handleSaveCourseMark(data: CourseMarkFormValues) {
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

    if (data.courseMarkId) {
      await updateCourseMarkMutation.mutateAsync({
        id: data.courseMarkId,
        data: courseMarkInsert,
      });
    } else {
      await createCourseMarkMutation.mutateAsync(courseMarkInsert);
    }
  }

  return (
    <View className='flex gap-5 overflow-visible'>
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
      <DraggableFlatList
        className='-mx-7'
        data={courseMarks}
        keyExtractor={item => item.id.toString()}
        onDragEnd={onReorderCourseMarks}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator activeScale={1.05}>
            <Pressable
              onLongPress={drag}
              className={cn(
                'px-7 flex flex-row gap-2 items-center',
                isActive && 'opacity-70'
              )}
            >
              <GripVertical className='text-secondary-foreground' size={20} />
              <CourseMarkListItem
                courseMark={item}
                onDelete={onCourseMarkDelete}
                onEdit={onCourseMarkEdit}
              />
            </Pressable>
          </ScaleDecorator>
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-5'>
            <Text>No marks found</Text>
          </View>
        }
      />
      <NewCourseMarkDialog
        open={newCourseMarkDialogOpen}
        onOpenChange={value => {
          setNewCourseMarkDialogOpen(value);
          if (!value) {
            setCourseMarkToEdit(null);
          }
        }}
        onFormSubmit={handleSaveCourseMark}
        courseMarkValues={courseMarkToEdit ?? undefined}
      />
    </View>
  );
}
