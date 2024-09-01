import { DrawerNavigationHelpers } from '@react-navigation/drawer/lib/typescript/src/types';
import { View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  Label,
  Option,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '~/components/ui';
import { useState } from 'react';
import { Button } from '~/components/ui/button';

interface BoatProfilePickerProps {
  navigation?: DrawerNavigationHelpers;
}

export function BoatProfilePicker({ navigation }: BoatProfilePickerProps) {
  const [boatProfile, setBoatProfile] = useState<Option | null>(null);

  return (
    <View>
      <Label nativeID='boatProfile' className='mb-1'>
        Boat Profile
      </Label>
      <Select value={boatProfile ?? undefined} onValueChange={setBoatProfile}>
        <SelectTrigger onPress={() => {}}>
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
  );
}
