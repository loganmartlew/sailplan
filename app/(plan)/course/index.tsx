import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, SubmitHandler } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { z } from 'zod';
import { FormControlWrapper, SelectInput, TextInput } from '~/components/form';
import {
  Button,
  H2,
  Option,
  Select,
  Separator,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '~/components/ui';
import { useCourseGroups, useCourseMarks, useCourses } from '~/features/course';
import { getMark } from '~/features/mark';
import {
  CoursePlanData,
  CustomLocation,
  customLocationSchema,
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
  startLocation: customLocationSchema.nullable(),
  finishLocation: customLocationSchema.nullable(),
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

  const course = watch('course');

  const { data: courseGroups } = useCourseGroups();
  const { data: courses } = useCourses({
    courseGroupId: courseGroupId ? parseInt(courseGroupId) : undefined,
  });
  const { data: courseMarks } = useCourseMarks(
    course?.value ? parseInt(course.value) : null
  );

  const onSubmit: SubmitHandler<PlanCourseForm> = async data => {
    let startLocation: CoursePlanData['startLocation'] | null = null;
    if (
      data.startLocation?.locationType === 'mark' &&
      data.startLocation.markId
    ) {
      startLocation = await getMark(data.startLocation.markId);
    }

    if (
      data.startLocation?.locationType === 'custom' &&
      data.startLocation.location
    ) {
      startLocation = {
        name: 'Start',
        ...data.startLocation.location,
      };
    }

    let finishLocation: CoursePlanData['finishLocation'] | null = null;
    if (
      data.finishLocation?.locationType === 'mark' &&
      data.finishLocation.markId
    ) {
      finishLocation = await getMark(data.finishLocation.markId);
    }
    if (
      data.finishLocation?.locationType === 'custom' &&
      data.finishLocation.location
    ) {
      finishLocation = {
        name: 'Finish',
        ...data.finishLocation.location,
      };
    }

    const planData: CoursePlanData = {
      // tws: data.tws,
      twd: data.twd,
      courseId: parseInt(data.course.value),
      startLocation,
      finishLocation,
    };

    const serializedPlanData = serializeCoursePlanData(planData);
    add({
      // tws: data.tws ?? null,
      twd: data.twd,
    });

    router.push({
      pathname: '/course/plan',
      params: { planData: serializedPlanData },
    });
  };

  const courseOptions: Option[] = courses.map(course => ({
    label: course.name,
    value: course.id.toString(),
  }));

  const mapMarks = courseMarks.map(courseMark => courseMark.mark) ?? [];

  return (
    <ScrollView>
      <View className='flex-1 justify-center items-center'>
        <Form className='w-full px-10 py-5 pb-20 flex flex-col gap-4'>
          <H2>Plan Course</H2>
          <Separator />
          {/* <TextInput<PlanLegForm> label='True Wind Speed (kn)' name='tws' /> */}
          <TextInput<PlanCourseForm>
            label='True Wind Direction (°)'
            name='twd'
            required
            inputMode='numeric'
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
          <Controller<PlanCourseForm, 'startLocation'>
            name='startLocation'
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <CustomLocation
                label='Start Location'
                name='startLocation'
                error={error}
                value={value ?? null}
                onChange={onChange}
                mapMarks={mapMarks}
              />
            )}
          />
          <Controller<PlanCourseForm, 'finishLocation'>
            name='finishLocation'
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <CustomLocation
                label='Finish Location'
                name='finishLocation'
                error={error}
                value={value ?? null}
                onChange={onChange}
                mapMarks={mapMarks}
              />
            )}
          />
          <Button onPress={handleSubmit(onSubmit)}>
            <Text>Plan</Text>
          </Button>
        </Form>
      </View>
    </ScrollView>
  );
}
