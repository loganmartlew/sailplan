import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Card, CardContent, H2, H3, Muted, Text } from '~/components/ui';
import { getMarkRouteUsage, MarkRouteUse } from '~/features/course';
import { MarkForm, MarkFormValues, updateMark, useMark } from '~/features/mark';

export default function MarkDetails() {
  const { markId } = useLocalSearchParams<{ markId: string }>();
  const { data: mark } = useMark(parseInt(markId));
  const [uses, setUses] = useState<MarkRouteUse[]>([]);
  useEffect(() => { getMarkRouteUsage(parseInt(markId)).then(usage => setUses(usage.uses)); }, [markId]);

  const onFormSubmit = async (data: MarkFormValues) => {
    if (!mark) {
      return;
    }

    await updateMark(mark.id, {
      name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
    });

    router.dismissTo('/marks');
  };

  const onFormCancel = () => {
    router.dismissTo('/marks');
  };

  if (!mark) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-6'>
      <Stack.Screen options={{ title: 'Marks' }} />
      <H2 className='pb-0'>{mark.name}</H2>
      <MarkForm
        onFormSubmit={onFormSubmit}
        onFormCancel={onFormCancel}
        markValues={{
          name: mark.name,
          latitude: mark.latitude,
          longitude: mark.longitude,
        }}
      />
      <View className='gap-2'><H3>Used by Courses</H3>{uses.length === 0 ? <Muted>Not used by a Course</Muted> : uses.map((use, index) => <Pressable key={`${use.courseId}:${use.role}:${index}`} onPress={() => router.push({ pathname: '/courses/(course)/[courseId]', params: { courseId: use.courseId.toString() } })}><Card><CardContent className='p-3'><Text className='font-semibold'>{use.courseName}</Text><Text className='text-sm text-muted-foreground'>{use.role === 'courseMark' ? 'Course Mark' : `Via Point in ${use.legName}`}</Text></CardContent></Card></Pressable>)}</View>
    </View>
  );
}
