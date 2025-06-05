import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { H2, Separator } from '~/components/ui';
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
    <View className='p-7 flex gap-5 h-full'>
      <Stack.Screen options={{ title: 'Marks' }} />
      <H2>New Mark</H2>
      <Separator />
      <MarkForm onFormSubmit={onFormSubmit} onFormCancel={onFormCancel} />
    </View>
  );
}
