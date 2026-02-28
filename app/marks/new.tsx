import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { H2 } from '~/components/ui';
import { createMark, MarkForm, MarkFormValues } from '~/features/mark';

export default function NewMark() {
  const onFormSubmit = async (data: MarkFormValues) => {
    await createMark({
      name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
    });

    router.dismissTo('/marks');
  };

  const onFormCancel = () => {
    router.dismissTo('/marks');
  };

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-6'>
      <Stack.Screen options={{ title: 'Marks' }} />
      <H2 className='pb-0'>New Mark</H2>
      <MarkForm onFormSubmit={onFormSubmit} onFormCancel={onFormCancel} />
    </View>
  );
}
