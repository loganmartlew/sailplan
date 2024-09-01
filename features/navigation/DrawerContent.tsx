import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { useState } from 'react';
import { View } from 'react-native-ui-lib';
import Picker from 'react-native-ui-lib/picker';

export function DrawerContent(props: DrawerContentComponentProps) {
  const [boatProfile, setBoatProfile] = useState<string | undefined>();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginVertical: 4, marginHorizontal: 10 }}>
        <Picker
          label='Boat Profile'
          placeholder='Select a Boat Profile'
          value={boatProfile}
          onChange={value => setBoatProfile(`${value}`)}
        >
          <Picker.Item
            label='Boogie Flash'
            value='1763254'
            labelStyle={{ marginVertical: 10 }}
          />
          <Picker.Item
            label='Max Headroom'
            value='4437623'
            labelStyle={{ marginVertical: 10 }}
          />
        </Picker>
      </View>
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </View>
  );
}
