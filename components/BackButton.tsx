import { useNavigation } from 'expo-router';
import { Button } from './ui';
import { ChevronLeft } from '~/lib/icons/ChevronLeft';

export function BackButton() {
  const { goBack } = useNavigation();

  return (
    <Button
      size='icon'
      variant='ghost'
      onPress={() => goBack()}
      className='mr-1'
    >
      <ChevronLeft className='text-muted-foreground' size={18} />
    </Button>
  );
}
