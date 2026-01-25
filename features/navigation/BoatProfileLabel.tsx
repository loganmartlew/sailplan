import { Badge, Text } from '~/components/ui';
import { useBoatProfile } from '../boatProfile';
import { Sailboat } from '~/lib/icons';

export function BoatProfileLabel() {
  const { boatProfile } = useBoatProfile();

  if (!boatProfile) {
    return null;
  }

  return (
    <Badge variant='secondary' className='flex-row items-center gap-2'>
      <Sailboat className='text-primary' size={16} />
      <Text className='text-md font-normal'>{boatProfile.name}</Text>
    </Badge>
  );
}
