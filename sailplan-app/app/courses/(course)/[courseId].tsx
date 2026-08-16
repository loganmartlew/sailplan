import { useMutation } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Badge, Button, H2, Text } from '~/components/ui';
import {
  CourseForm,
  CourseFormValues,
  CourseMarks,
  CourseRouteThread,
  updateCourse,
  useCourse,
} from '~/features/course';
import { Pencil } from '~/lib/icons';

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
      if (router.canGoBack()) {
        router.back();
      } else {
        router.dismissTo('/courses');
      }
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

  const detailsSlot = <View className='gap-8'><CourseRouteThread course={course} /><CourseMarks course={course} /></View>;

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-6'>
      <Stack.Screen options={{ title: 'Courses' }} />
      <View className='flex-row items-center justify-between'>
        <H2 className='pb-0'>{course.name}</H2>
        <View className='flex-row items-center gap-2'>
          {course.courseGroup && (
            <Badge variant='transparent'>
              <Text className='text-sm'>{course.courseGroup.name}</Text>
            </Badge>
          )}
          {!editMode && (
            <Button
              variant='ghost'
              size='icon'
              onPress={() => setEditMode(true)}
            >
              <Pencil className='text-muted-foreground' size={16} />
            </Button>
          )}
        </View>
      </View>
      <ScrollView>{editMode ? editSlot : detailsSlot}</ScrollView>
    </View>
  );
}
