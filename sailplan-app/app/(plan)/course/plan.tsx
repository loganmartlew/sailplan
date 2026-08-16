import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Badge, H2, Text } from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile';
import { coordsToBearing, getTwa } from '~/features/coordinate';
import { useCourse, useCourseRoute } from '~/features/course';
import {
  CourseLegCard,
  CourseMarkListDialog,
  buildPlanRoute,
  deserializeCoursePlanData,
  TrueWindInputCard,
  usePlanState,
} from '~/features/plan';
import { useSailSuggestionData } from '~/features/sailSuggestion';

export default function CoursePlanResults() {
  const { planData: data } = useLocalSearchParams<{ planData: string }>();
  const planData = deserializeCoursePlanData(data);

  const { currentState } = usePlanState();
  const twd = currentState?.twd ?? 0;

  const { boatProfile } = useBoatProfile();
  const suggestionData = useSailSuggestionData(boatProfile?.id ?? null);

  const { data: course, error: courseError } = useCourse(planData.courseId);
  const { data: courseRoute, error: courseRouteError } = useCourseRoute(
    planData.courseId,
  );

  const isLoading =
    !course || (!courseRoute && !courseError && !courseRouteError);
  const isError = !!courseError || !!courseRouteError;

  const planRoute = useMemo(
    () =>
      courseRoute
        ? buildPlanRoute({
            route: courseRoute,
            startLocation: planData.startLocation,
            finishLocation: planData.finishLocation,
          })
        : undefined,
    [courseRoute, planData],
  );

  const segments = useMemo(
    () =>
      planRoute?.legs.flatMap(leg =>
        leg.segments.map(segment => {
          const bearing = coordsToBearing({ from: segment.from, to: segment.to });
          return { ...segment, bearing, twa: getTwa({ bearing, twd }) };
        }),
      ) ?? [],
    [planRoute, twd],
  );

  if (isLoading) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    console.error(courseError, courseRouteError);
    return (
      <View>
        <Text>Error loading data</Text>
      </View>
    );
  }

  return (
    <View className='py-5 px-3 flex gap-5 h-full'>
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
        <CourseMarkListDialog
          courseMarks={
            courseRoute?.points.filter(
              point => point.kind === 'courseMark',
            ) ?? []
          }
        />
      </View>
      <TrueWindInputCard twd tws />
      <ScrollView>
        <View className='flex gap-4 pb-4'>
          {segments.map(segment => (
            <CourseLegCard
              key={segment.key}
              from={segment.from}
              to={segment.to}
              bearing={segment.bearing}
              twa={segment.twa}
              tws={currentState?.tws ?? 0}
              suggestionData={suggestionData}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
