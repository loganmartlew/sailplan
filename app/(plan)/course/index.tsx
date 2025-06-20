import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { FormControlWrapper, SelectInput, TextInput } from '~/components/form';
import { Button, H2, Option, Select, Separator, Text } from '~/components/ui';
import { useCourseGroups, useCourses } from '~/features/course';
import {
  CoursePlanData,
  serializeCoursePlanData,
  usePlanState,
} from '~/features/plan';
import { useForm } from '~/hooks/useForm';

const planCourseFormSchema = z.object({
  // tws: z.coerce
  //   .number({ invalid_type_error: 'TWS must be a number' })
  //   .min(0, { message: 'TWS must be a positive number' })
  //   .optional(),
  twd: z
    .string({ required_error: 'TWD is required' })
    .min(1, { message: 'TWD is required' })
    .pipe(
      z.coerce
        .number({
          required_error: 'TWD is required',
          invalid_type_error: 'TWD must be a number',
        })
        .int()
        .min(0, 'TWD must be between 0 and 360')
        .max(360, 'TWD must be between 0 and 360')
    ),
  course: z.object(
    {
      value: z.string(),
    },
    { message: 'Course is required' }
  ),
});

type PlanCourseForm = z.infer<typeof planCourseFormSchema>;

export default function PlanCoursePage() {
  const router = useRouter();
  const { add, currentState } = usePlanState();

  const [Form, { handleSubmit, watch }] = useForm<PlanCourseForm>({
    resolver: zodResolver(planCourseFormSchema),
    defaultValues: {
      // tws: (currentState?.tws?.toString() as unknown as number) ?? undefined,
      twd: currentState?.twd.toString() as unknown as number | undefined,
    },
  });

  const [courseGroupId, setCourseGroupId] = useState<string | null>(null);

  const { data: courseGroups } = useCourseGroups();
  const { data: courses } = useCourses();

  const onSubmit: SubmitHandler<PlanCourseForm> = data => {
    const course = courses.find(
      course => course.id === parseInt(data.course.value)
    );

    if (!course) return;

    const planData: CoursePlanData = {
      // tws: data.tws,
      twd: data.twd,
      course: course,
    };

    const serializedPlanData = serializeCoursePlanData(planData);
    add({
      // tws: data.tws ?? null,
      twd: data.twd,
    });

    router.push({
      pathname: '/plan',
      params: { planData: serializedPlanData },
    });
  };

  const courseOptions: Option[] = courses
    .filter(
      course =>
        !courseGroupId || courseGroupId === course.courseGroupId?.toString()
    )
    .map(course => ({
      label: course.name,
      value: course.id.toString(),
    }));

  return (
    <View className='flex-1 justify-center items-center'>
      <Form className='w-full px-10 py-5 pb-20 flex flex-col gap-4'>
        <H2>Plan Course</H2>
        <Separator />
        {/* <TextInput<PlanLegForm> label='True Wind Speed (kn)' name='tws' /> */}
        <TextInput<PlanCourseForm>
          label='True Wind Direction (°)'
          name='twd'
          required
        />
        {courseGroups.length > 0 && (
          <FormControlWrapper label='Course Group' name='courseGroup'>
            <Select
              options={courseGroups.map(group => ({
                label: group.name,
                value: group.id.toString(),
              }))}
              value={courseGroupId}
              onValueChange={value => setCourseGroupId(value)}
              placeholder={{
                label: 'Select a course group',
                value: null,
              }}
            />
          </FormControlWrapper>
        )}
        <SelectInput<PlanCourseForm>
          label='Course'
          name='course'
          options={courseOptions}
          required
        />
        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Plan</Text>
        </Button>
      </Form>
    </View>
  );
}
