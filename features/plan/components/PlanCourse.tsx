import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import {
  FormControlWrapper,
  NumberInput,
  SelectInput,
} from '~/components/form';
import { Button, Option, Select, Text } from '~/components/ui';
import { useCourseGroups, useCourseMarks, useCourses } from '~/features/course';
import { getMark } from '~/features/mark';
import { useForm } from '~/hooks/useForm';
import { CustomLocation, customLocationSchema } from './CustomLocation';
import { usePlanState } from '../store/planStore';
import {
  CoursePlanData,
  serializeCoursePlanData,
} from '../model/coursePlanData';
import { TrueWindInputCard } from './TrueWindInputCard';

const planCourseFormSchema = z.object({
  course: z.object(
    {
      value: z.string(),
    },
    { message: 'Course is required' },
  ),
  startLocation: customLocationSchema.nullable(),
  finishLocation: customLocationSchema.nullable(),
});

type PlanCourseForm = z.infer<typeof planCourseFormSchema>;

export function PlanCourse() {
  const router = useRouter();

  const [Form, { handleSubmit, watch }] = useForm<PlanCourseForm>({
    resolver: zodResolver(planCourseFormSchema),
    defaultValues: {
      finishLocation: null,
      startLocation: null,
    },
  });

  const [courseGroupId, setCourseGroupId] = useState<string | null>(null);

  const course = watch('course');

  const { data: courseGroups } = useCourseGroups();
  const { data: courses } = useCourses({
    courseGroupId: courseGroupId ? parseInt(courseGroupId) : undefined,
  });
  const { data: courseMarks } = useCourseMarks(
    course?.value ? parseInt(course.value) : null,
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
      courseId: parseInt(data.course.value),
      startLocation,
      finishLocation,
    };

    const serializedPlanData = serializeCoursePlanData(planData);

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
    <Form className='w-full flex flex-col gap-6'>
      <TrueWindInputCard twd />
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
  );
}
