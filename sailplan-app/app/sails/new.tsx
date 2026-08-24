import { router } from 'expo-router';
import { View } from 'react-native';
import { H2 } from '~/components/ui';
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
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-6'>
      <H2 className='pb-0'>New Sail</H2>
      <SailForm onFormSubmit={onFormSubmit} onFormCancel={onFormCancel} />
    </View>
  );
}
