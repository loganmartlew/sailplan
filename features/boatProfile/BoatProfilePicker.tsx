import { DrawerNavigationHelpers } from '@react-navigation/drawer/lib/typescript/src/types';
import { View } from 'react-native';
import {
  Label,
  Option,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui';
import { Plus } from '~/lib/icons/Plus';
import { useState } from 'react';

export function BoatProfilePicker() {
  const [boatProfile, setBoatProfile] = useState<Option | null>(null);

  return (
    <View>
      <Label nativeID='boatProfile' className='mb-1'>
        Boat Profile
      </Label>
      <Select value={boatProfile ?? undefined} onValueChange={setBoatProfile}>
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
            <SelectItem
              label='New Profile'
              value='-1'
              icon={<Plus />}
              textClassName='italic'
            />
          </SelectGroup>
        </SelectContent>
      </Select>
    </View>
  );
}
