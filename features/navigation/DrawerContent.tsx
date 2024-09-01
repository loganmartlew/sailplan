import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { View } from 'react-native';
import { H1 } from '~/components/ui';
import { BoatProfilePicker } from '../boatProfile';

export function DrawerContent(props: DrawerContentComponentProps) {
  return (
    <View className='p-3 pt- flex flex-col gap-3'>
      <View>
        <H1>SailPlan</H1>
      </View>
      <BoatProfilePicker navigation={props.navigation} />
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{
          padding: 0,
          flex: 1,
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </View>
  );
}
