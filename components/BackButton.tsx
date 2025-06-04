import { useRouter } from 'expo-router';
import { Button } from './ui';
import { ChevronLeft } from '~/lib/icons/ChevronLeft';

export function BackButton() {
  const router = useRouter();

  const back = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/');
    }
  };

  return (
    <Button size='icon' variant='ghost' onPress={back} className='mr-1'>
      <ChevronLeft className='text-muted-foreground' size={18} />
    </Button>
  );
}
