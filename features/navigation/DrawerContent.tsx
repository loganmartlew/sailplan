import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
} from '@react-navigation/drawer';
import { ActivityIndicator, View } from 'react-native';
import { H1, Separator, Text } from '~/components/ui';
import { BoatProfilePicker } from '../boatProfile';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Suspense } from 'react';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { top } = useSafeAreaInsets();

  return (
    <View className='p-3 flex flex-col gap-5' style={{ paddingTop: top + 10 }}>
      <View>
        <H1>SailPlan</H1>
      </View>
      <Suspense fallback={<ActivityIndicator size='large' />}>
        <BoatProfilePicker />
      </Suspense>
      <Separator />
      <View className='flex flex-col gap-2'>
        <DrawerItemList {...props} />
      </View>
    </View>
  );
}
