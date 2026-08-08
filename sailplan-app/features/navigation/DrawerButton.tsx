import { DrawerToggleButton } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';

export function DrawerButton() {
  const navigation = useNavigation();

  const onButtonPress = () => {
    navigation.dispatch(DrawerActions.toggleDrawer());
  };

  return DrawerToggleButton;
}
