import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { useState } from 'react';
import { View } from 'react-native';
import { Label } from '~/components/ui';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

export function DrawerContent(props: DrawerContentComponentProps) {
  return (
    <View className='p-3 flex flex-col gap-3'>
      <View>
        <Label nativeID='boatProfile' className='mb-1'>
          Boat Profile
        </Label>
        <Select>
          <SelectTrigger>
            <SelectValue
              className='text-foreground text-sm native:text-lg'
              placeholder='Select a Boat Profile'
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem label='Boogie Flash' value='13725' />
              <SelectItem label='Max Headroom' value='73245' />
            </SelectGroup>
          </SelectContent>
        </Select>
      </View>
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
