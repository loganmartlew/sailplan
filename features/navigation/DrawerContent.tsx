import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { View } from 'react-native';
import { H1, Separator, Text } from '~/components/ui';
import { BoatProfilePicker } from '../boatProfile';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { top } = useSafeAreaInsets();

  return (
    <View className='p-3 flex flex-col gap-5' style={{ paddingTop: top + 10 }}>
      <View>
        <H1>SailPlan</H1>
      </View>
      <BoatProfilePicker />
      <Separator />
      <View className='flex flex-col gap-2'>
        <DrawerItemList {...props} />
      </View>
    </View>
  );
}
