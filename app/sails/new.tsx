import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { H2, Separator } from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile';
import { createSail, SailForm, SailFormValues } from '~/features/sail';

export default function NewSail() {
  const { boatProfile } = useBoatProfile();

  const onFormSubmit = async (data: SailFormValues) => {
    if (!boatProfile) return;

    await createSail({
      name: data.name,
      color: data.color,
      sailArea: data.sailArea,
      symmetrical: data.symmetrical === 'symmetrical',
      boatProfileId: boatProfile.id,
    });

    router.dismissTo('/sails');
  };

  const onFormCancel = () => {
    router.dismissTo('/sails');
  };

  return (
    <View className='p-7 flex gap-5 h-full'>
      <H2>New Sail</H2>
      <Separator />
      <SailForm onFormSubmit={onFormSubmit} onFormCancel={onFormCancel} />
    </View>
  );
}
