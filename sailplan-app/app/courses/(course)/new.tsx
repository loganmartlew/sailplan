import { useMutation } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { H2 } from '~/components/ui';
import { CourseForm, CourseFormValues, createCourse } from '~/features/course';

export default function NewCourse() {
  const { courseGroupId, courseGroupName } = useLocalSearchParams<{
    courseGroupId?: string;
    courseGroupName?: string;
  }>();

  const courseMutation = useMutation({
    mutationFn: (data: CourseFormValues) =>
      createCourse({
        name: data.name,
        courseGroupId: data.courseGroup?.value
          ? parseInt(data.courseGroup?.value)
          : null,
      }),
  });

  const onFormSubmit = async (data: CourseFormValues) => {
    const course = await courseMutation.mutateAsync(data);

    router.replace({
      pathname: '/courses/[courseId]',
      params: { courseId: course.id.toString() },
    });
  };

  const onFormCancel = () => {
    router.dismissTo('/courses');
  };

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-6'>
      <Stack.Screen options={{ title: 'Courses' }} />
      <H2 className='pb-0'>New Course</H2>
      <CourseForm
        onFormSubmit={onFormSubmit}
        onFormCancel={onFormCancel}
        courseValues={
          courseGroupId && courseGroupName
            ? {
                courseGroup: {
                  label: courseGroupName,
                  value: courseGroupId,
                },
              }
            : undefined
        }
      />
    </View>
  );
}
