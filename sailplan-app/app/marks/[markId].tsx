import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { H2 } from '~/components/ui';
import { MarkForm, MarkFormValues, updateMark, useMark } from '~/features/mark';

export default function MarkDetails() {
  const { markId } = useLocalSearchParams<{ markId: string }>();
  const { data: mark } = useMark(parseInt(markId));

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
    </View>
  );
}
