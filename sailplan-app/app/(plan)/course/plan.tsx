import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Badge, H2, Text } from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile';
import { coordsToBearing, getTwa, TWA } from '~/features/coordinate';
import {
  CourseMarkWithMark,
  useCourse,
  useCourseMarks,
} from '~/features/course';
import {
  CourseLegCard,
  CourseMarkListDialog,
  deserializeCoursePlanData,
  TrueWindInputCard,
  usePlanState,
} from '~/features/plan';
import { useSailSuggestionData } from '~/features/sailSuggestion';
import { CaptureRecordingControl } from '~/features/capture';

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

  const { currentState } = usePlanState();
  const twd = currentState?.twd ?? 0;

  const { boatProfile } = useBoatProfile();
  const suggestionData = useSailSuggestionData(boatProfile?.id ?? null);

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
        <CourseMarkListDialog courseMarks={courseMarks} />
      </View>
      <TrueWindInputCard twd tws />
      <ScrollView>
        <View className='flex gap-4 pb-24'>
          {legs.map(leg => (
            <CourseLegCard
              key={leg.key}
              from={leg.from}
              to={leg.to}
              bearing={leg.bearing}
              twa={leg.twa}
              tws={currentState?.tws ?? 0}
              suggestionData={suggestionData}
            />
          ))}
        </View>
      </ScrollView>
      {boatProfile && (
        <CaptureRecordingControl
          boatProfileId={boatProfile.id}
          courseId={planData.courseId}
        />
      )}
    </View>
  );
}
