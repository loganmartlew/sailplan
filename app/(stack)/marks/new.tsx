import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { H2, Separator } from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile/hooks/useBoatProfile';
import { createMark, MarkForm, MarkFormValues } from '~/features/mark';

export default function NewMark() {
  const { boatProfile } = useBoatProfile();

  const onFormSubmit = async (data: MarkFormValues) => {
    if (!boatProfile) {
      return;
    }

    await createMark({
      name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
      boatProfileId: boatProfile.id,
    });

    router.navigate('/(drawer)/marks');
  };

  return (
    <View className='p-7 flex gap-5 h-full'>
      <Stack.Screen options={{ title: 'Marks' }} />
      <H2>New Mark</H2>
      <Separator />
      <MarkForm onFormSubmit={onFormSubmit} />
    </View>
  );
}
