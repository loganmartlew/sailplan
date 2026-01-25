import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { z } from 'zod';
import { NumberInput, TextInput } from '~/components/form';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H2,
  Separator,
  Text,
} from '~/components/ui';
import { coordsToBearing, getTwa, TWA } from '~/features/coordinate';
import {
  CourseMarkWithMark,
  useCourse,
  useCourseMarks,
} from '~/features/course';
import { deserializeCoursePlanData, usePlanState } from '~/features/plan';
import { useForm } from '~/hooks/useForm';
import { formatAngle } from '~/lib/format';
import { cn } from '~/lib/utils';
import { RefreshCw } from '~/lib/icons/RefreshCw';
import { SubmitHandler } from 'react-hook-form';

interface Leg {
  from: CourseMarkWithMark;
  to: CourseMarkWithMark;
  key: string;
  bearing: number;
  twa: TWA;
}

const courseFormSchema = z.object({
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
        .max(360, 'TWD must be between 0 and 360'),
    ),
});

type CourseForm = z.infer<typeof courseFormSchema>;

export default function CoursePlanResults() {
  const { planData: data } = useLocalSearchParams<{ planData: string }>();
  const planData = deserializeCoursePlanData(data);

  const { add } = usePlanState();

  const { data: course, error: courseError } = useCourse(planData.courseId);
  const { data: courseMarks, error: courseMarksError } = useCourseMarks(
    planData.courseId,
  );

  const [twd, setTwd] = useState<number | undefined>();
  const [twdLoading, setTwdLoading] = useState(false);

  const isLoading =
    !course || (!courseMarks && !courseError && !courseMarksError);
  const isError = !!courseError || !!courseMarksError;

  const [Form, { handleSubmit }] = useForm<CourseForm>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      twd: planData.twd.toString() as unknown as number | undefined,
    },
  });

  const legs = useMemo(() => {
    const marks: CourseMarkWithMark[] = [
      ...(planData.startLocation
        ? [
            {
              id: -1,
              courseId: planData.courseId,
              markId: -1,
              order: courseMarks[0]?.order - 1,
              direction: null,
              mark: {
                id: -1,
                name: planData.startLocation.name,
                latitude: planData.startLocation.latitude,
                longitude: planData.startLocation.longitude,
              },
            },
          ]
        : []),
      ...courseMarks,
      ...(planData.finishLocation
        ? [
            {
              id: -2,
              courseId: planData.courseId,
              markId: -2,
              order: courseMarks[courseMarks.length - 1]?.order + 1,
              direction: null,
              mark: {
                id: -2,
                name: planData.finishLocation.name,
                latitude: planData.finishLocation.latitude,
                longitude: planData.finishLocation.longitude,
              },
            },
          ]
        : []),
    ];

    const legs: Leg[] = [];
    for (let i = 0; i < marks.length - 1; i++) {
      const from = marks[i];
      const to = marks[i + 1];
      const bearing = coordsToBearing(from.mark, to.mark);
      const twa = getTwa(bearing, twd ?? planData.twd);
      legs.push({
        from,
        to,
        bearing,
        twa,
        key: `${from.mark.id}-${to.mark.id}-[${i}]`,
      });
    }

    return legs;
  }, [planData, courseMarks, twd]);

  const onSubmit: SubmitHandler<CourseForm> = async data => {
    setTwdLoading(true);
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate loading
    setTwd(data.twd);
    setTwdLoading(false);
  };

  if (isLoading) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    console.error(courseError, courseMarksError);
    return (
      <View>
        <Text>Error loading data</Text>
      </View>
    );
  }

  return (
    <View className='p-7 flex gap-5 h-full'>
      <H2>{course?.name ?? 'Course Plan'}</H2>
      <Form className='w-full flex flex-row gap-2 items-end'>
        <NumberInput<CourseForm>
          label='True Wind Direction (°)'
          placeholder='e.g: 163'
          name='twd'
          required
        />
        <Button size='default' onPress={handleSubmit(onSubmit)}>
          <RefreshCw />
        </Button>
      </Form>
      <Separator />
      <ScrollView>
        <View className='flex gap-4'>
          {legs.map(leg => (
            <Card key={leg.key}>
              <CardHeader className='pb-3 flex gap-1'>
                <CardTitle>
                  {leg.from.mark.name}{' '}
                  <Text
                    className={cn({
                      'text-green-400': leg.from.direction === 'starboard',
                      'text-red-400': leg.from.direction === 'port',
                    })}
                  >
                    {leg.from.direction === 'starboard'
                      ? ' S'
                      : leg.from.direction === 'port'
                        ? ' P'
                        : ''}
                  </Text>
                </CardTitle>
                <CardTitle>
                  {leg.to.mark.name}{' '}
                  <Text
                    className={cn({
                      'text-green-400': leg.to.direction === 'starboard',
                      'text-red-400': leg.to.direction === 'port',
                    })}
                  >
                    {leg.to.direction === 'starboard'
                      ? ' S'
                      : leg.to.direction === 'port'
                        ? ' P'
                        : ''}
                  </Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View className='flex flex-row gap-2'>
                  <Text className='text-lg w-[50%]'>Bearing:</Text>
                  <Text className='text-lg w-[50%]'>
                    {formatAngle(leg.bearing)}
                  </Text>
                </View>
                <View className='flex flex-row gap-2'>
                  <Text className='text-lg w-[50%]'>TWA:</Text>
                  {twdLoading ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className='text-lg w-[50%]'>
                      {formatAngle(leg.twa.angle)}
                      {leg.twa.tack ? ` (${leg.twa.tack})` : ''}
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
