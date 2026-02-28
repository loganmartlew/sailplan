import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H2,
  Label,
  Separator,
  Text,
} from '~/components/ui';
import { coordsToBearing, getTwa, TWA } from '~/features/coordinate';
import {
  CourseMarkWithMark,
  useCourse,
  useCourseMarks,
} from '~/features/course';
import {
  CourseMarkListDialog,
  deserializeCoursePlanData,
  TackDirectionBadge,
  TrueWindInputCard,
  usePlanState,
} from '~/features/plan';
import { formatAngle } from '~/lib/format';
import { cn } from '~/lib/utils';
import { MoveRight } from '~/lib/icons';
import { useTheme } from '@react-navigation/native';

interface Leg {
  from: CourseMarkWithMark;
  to: CourseMarkWithMark;
  key: string;
  bearing: number;
  twa: TWA;
}

export default function CoursePlanResults() {
  const { planData: data } = useLocalSearchParams<{ planData: string }>();
  const planData = deserializeCoursePlanData(data);

  const theme = useTheme();

  const { currentState } = usePlanState();
  const twd = currentState?.twd ?? 0;

  const { data: course, error: courseError } = useCourse(planData.courseId);
  const { data: courseMarks, error: courseMarksError } = useCourseMarks(
    planData.courseId,
  );

  const isLoading =
    !course || (!courseMarks && !courseError && !courseMarksError);
  const isError = !!courseError || !!courseMarksError;

  const legs = useMemo(() => {
    if (!courseMarks) return [];

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
      const bearing = coordsToBearing({ from: from.mark, to: to.mark });
      const twa = getTwa({ bearing, twd });
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
    <View className='py-7 px-3 flex gap-5 h-full'>
      <H2 className='pb-0'>Course Plan</H2>
      <View className='flex-row items-center justify-between'>
        <View className='flex-row gap-2 items-center'>
          {course?.courseGroup && (
            <Badge variant='transparent'>
              <Text className='text-sm'>
                Course Group: {course?.courseGroup?.name}
              </Text>
            </Badge>
          )}
          <Badge variant='transparent'>
            <Text className='text-sm'>Course: {course?.name}</Text>
          </Badge>
        </View>
        <CourseMarkListDialog courseMarks={courseMarks} />
      </View>
      <TrueWindInputCard twd />
      <ScrollView>
        <View className='flex gap-4 pb-4'>
          {legs.map(leg => (
            <Card key={leg.key}>
              <CardHeader className='pb-3'>
                <View className='flex flex-row items-center gap-2'>
                  <CardTitle className='shrink'>
                    {leg.from.mark.name}
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
                  <View className='self-center text-primary-foreground opacity-65'>
                    <MoveRight size={16} color={theme.colors.text} />
                  </View>
                  <CardTitle className='shrink' showBullet={false}>
                    {leg.to.mark.name}
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
                </View>
              </CardHeader>
              <CardContent className='flex gap-4'>
                <View className='flex flex-row gap-2'>
                  <Label className='grow text-base'>Bearing:</Label>
                  <Text className='grow text-right text-4xl font-bold'>
                    {formatAngle(leg.bearing)}
                  </Text>
                </View>
                <Separator />
                <View className='flex flex-row gap-2'>
                  <Label className='grow text-base'>TWA:</Label>
                  <View className='grow flex items-end gap-2'>
                    <Text className='grow text-right text-4xl font-bold text-primary'>
                      {formatAngle(leg.twa.angle)}
                    </Text>
                    {leg.twa.tack && <TackDirectionBadge tack={leg.twa.tack} />}
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
