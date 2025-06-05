import { Text } from '~/components/ui';
import { useBoatProfile } from '../boatProfile';

export function BoatProfileLabel() {
  const { boatProfile } = useBoatProfile();

  if (!boatProfile) {
    return null;
  }

  return <Text className='italic mr-4'>{boatProfile.name}</Text>;
}
