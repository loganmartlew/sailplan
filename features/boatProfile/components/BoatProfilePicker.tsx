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
import { useBoatProfile } from '../hooks/useBoatProfile';
import { useBoatProfiles } from '../api/getBoatProfiles';
import { BoatProfile } from '../types/boatProfile';

function boatProfileToOption(boatProfile: BoatProfile | null): Option {
  if (!boatProfile) return undefined;
  return {
    label: boatProfile.name,
    value: boatProfile.id,
  };
}

function optionToBoatProfile(option: Option): BoatProfile | null {
  if (!option) return null;
  return {
    id: option.value,
    name: option.label,
  };
}

export function BoatProfilePicker() {
  const { boatProfile, setBoatProfile } = useBoatProfile();
  const { data: boatProfiles } = useBoatProfiles();

  return (
    <View>
      <Label nativeID='boatProfile' className='mb-1'>
        Boat Profile
      </Label>
      <Select
        value={boatProfileToOption(boatProfile) ?? undefined}
        onValueChange={option => setBoatProfile(optionToBoatProfile(option))}
      >
        <SelectTrigger>
          <SelectValue
            className='text-foreground text-sm native:text-lg'
            placeholder='Select a Boat Profile'
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {boatProfiles.map(profile => (
              <SelectItem
                key={profile.id}
                label={profile.name}
                value={profile.id}
              />
            ))}
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
