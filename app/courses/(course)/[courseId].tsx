import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, H2, Separator } from '~/components/ui';
import {
  CourseForm,
  CourseFormValues,
  updateCourse,
  useCourse,
} from '~/features/course';
import { Pencil } from '~/lib/icons/Pencil';

export default function CourseDetailsPage() {
  const { courseId, edit } = useLocalSearchParams<{
    courseId: string;
    edit?: string;
  }>();
  const { data: course } = useCourse(parseInt(courseId));

  const [editMode, setEditMode] = useState(!!edit);

  const courseMutation = useMutation({
    mutationFn: (data: CourseFormValues) =>
      updateCourse(parseInt(courseId), {
        name: data.name,
        courseGroupId: data.courseGroup?.value
          ? parseInt(data.courseGroup?.value)
          : null,
      }),
  });

  const onFormSubmit = async (data: CourseFormValues) => {
    if (!course) {
      return;
    }

    await courseMutation.mutateAsync(data);

    if (!!edit) {
      router.dismissTo('/courses');
    } else {
      setEditMode(false);
    }
  };

  const onFormCancel = () => {
    if (!!edit) {
      router.dismissTo('/courses');
    } else {
      setEditMode(false);
    }
  };

  if (!course) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  const editSlot = (
    <CourseForm
      onFormSubmit={onFormSubmit}
      onFormCancel={onFormCancel}
      courseValues={{
        name: course.name,
        courseGroup: course.courseGroup
          ? {
              label: course.courseGroup.name,
              value: course.courseGroup.id.toString(),
            }
          : undefined,
      }}
    />
  );

  const detailsSlot = null;

  return (
    <View className='p-7 flex gap-5 h-full'>
      <View className='flex flex-row justify-between'>
        <H2>{course.name}</H2>
        {!editMode && (
          <Button variant='ghost' size='icon' onPress={() => setEditMode(true)}>
            <Pencil className='text-foreground' size={18} />
          </Button>
        )}
      </View>
      <Separator />
      {editMode ? editSlot : detailsSlot}
    </View>
  );
}
