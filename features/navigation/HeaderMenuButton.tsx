import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { ColorValue } from 'react-native';
import { Button } from '~/components/ui';
import { Menu } from '~/lib/icons/Menu';

interface HeaderMenuButtonProps {
  color: ColorValue;
}

export function HeaderMenuButton({ color }: HeaderMenuButtonProps) {
  const { dispatch } = useNavigation();

  const openDrawer = () => {
    dispatch(DrawerActions.openDrawer());
  };

  return (
    <Button variant='link' className='p-2 ml-2' onPress={openDrawer}>
      <Menu color={color} />
    </Button>
  );
}
