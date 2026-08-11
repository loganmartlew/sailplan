import { ScrollView, View } from 'react-native';
import { H2, Muted, Text } from '~/components/ui';
import { PlotterConnectionSection } from '~/features/capture';
import { useBoatProfile } from '../hooks/useBoatProfile';

export function BoatProfileDetails() {
  const { boatProfile } = useBoatProfile();

  if (!boatProfile) return null;

  return (
    <ScrollView className='flex-1' contentContainerClassName='px-3 py-5 gap-5'>
      <View className='gap-1'>
        <H2>{boatProfile.name}</H2>
        <Muted>
          Plotter setup belongs to this boat. Switch profiles from the boat name
          in the header to configure another one.
        </Muted>
      </View>
      <PlotterConnectionSection boatProfileId={boatProfile.id} />
      <Text className='text-sm text-muted-foreground'>
        Saving an address only configures this profile. It does not connect to
        the plotter or change your Wi-Fi network.
      </Text>
    </ScrollView>
  );
}
