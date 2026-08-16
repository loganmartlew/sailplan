import { useConfirm } from '~/hooks/useConfirm';
import { Course } from '../model/course';
import { useMemo, useState } from 'react';
import {
  createCourseMark,
  deleteCourseMark,
  reorderCourseMarks,
  updateCourseMark,
  useCourseRoute,
} from '../api/courseRoute';
import { View } from 'react-native';
import { Badge, Button, H3, Muted, Text } from '~/components/ui';
import { Plus, MapPin } from '~/lib/icons';
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
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { cn } from '~/lib/utils';

interface CourseMarksProps {
  course: Course;
}

export function CourseMarks({ course }: CourseMarksProps) {
  const confirm = useConfirm();
  const { data: route } = useCourseRoute(course.id);
  const courseMarks = useMemo<CourseMarkWithMark[]>(
    () =>
      route?.points.flatMap((point, order) =>
        point.kind === 'courseMark'
          ? [
              {
                id: point.courseMarkId,
                courseId: course.id,
                markId: point.markId,
                order,
                direction: point.direction,
                note: point.note,
                mark: {
                  id: point.markId,
                  name: point.name,
                  latitude: point.latitude,
                  longitude: point.longitude,
                },
              },
            ]
          : [],
      ) ?? [],
    [course.id, route],
  );

  const [newCourseMarkDialogOpen, setNewCourseMarkDialogOpen] = useState(false);
  const [courseMarkToEdit, setCourseMarkToEdit] =
    useState<CourseMarkFormValues | null>(null);

  const createCourseMarkMutation = useMutation({
    mutationFn: (data: Omit<CourseMarkInsert, 'id' | 'order'>) =>
      createCourseMark(data),
  });

  const updateCourseMarkMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<Pick<CourseMarkInsert, 'markId' | 'direction' | 'note'>>;
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
    await reorderCourseMarks({ courseId: course.id, from, to });
  }

  async function handleSaveCourseMark(data: CourseMarkFormValues) {
    const markId = data.mark.value ? parseInt(data.mark.value) : null;
    if (!markId) {
      console.error('Mark ID is required to create a new course mark');
      return;
    }

    const courseMarkInsert: Omit<CourseMarkInsert, 'id' | 'order'> = {
      courseId: course.id,
      markId,
      direction: data.direction === 'none' ? null : data.direction,
    };

    if (data.courseMarkId) {
      await updateCourseMarkMutation.mutateAsync({
        id: data.courseMarkId,
        data: {
          markId,
          direction: courseMarkInsert.direction,
        },
      });
    } else {
      await createCourseMarkMutation.mutateAsync(courseMarkInsert);
    }
  }

  return (
    <View className='flex gap-5 overflow-visible'>
      <View className='flex-row items-center justify-between'>
        <View className='flex-row items-center gap-2'>
          <H3>Marks</H3>
          {courseMarks.length > 0 && (
            <Badge variant='transparent'>
              <Text className='text-xs'>
                {courseMarks.length}{' '}
                {courseMarks.length === 1 ? 'mark' : 'marks'}
              </Text>
            </Badge>
          )}
        </View>
        <Button
          variant='secondary'
          size='icon'
          onPress={() => setNewCourseMarkDialogOpen(true)}
          disabled={createCourseMarkMutation.isPending}
        >
          <Plus className='text-secondary-foreground' size={18} />
        </Button>
      </View>
      <DraggableFlatList
        data={courseMarks}
        keyExtractor={item => item.id.toString()}
        onDragEnd={onReorderCourseMarks}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator activeScale={1.05}>
            <View className={cn(isActive && 'opacity-70')}>
              <CourseMarkListItem
                courseMark={item}
                onDelete={onCourseMarkDelete}
                onEdit={onCourseMarkEdit}
                onDrag={drag}
              />
            </View>
          </ScaleDecorator>
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-10 gap-2'>
            <MapPin className='text-muted-foreground' size={32} />
            <Muted>No marks yet</Muted>
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
