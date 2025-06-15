import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { H2, Separator } from '~/components/ui';
import { CourseForm, CourseFormValues, createCourse } from '~/features/course';

export default function NewCourse() {
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
    <View className='p-7 flex gap-5 h-full'>
      <H2>New Course</H2>
      <Separator />
      <CourseForm onFormSubmit={onFormSubmit} onFormCancel={onFormCancel} />
    </View>
  );
}
