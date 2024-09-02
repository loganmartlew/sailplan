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
import { useState } from 'react';
import {
  BoatProfileFormValues,
  NewBoatProfileDialog,
} from './NewBoatProfileDialog';

function boatProfileToOption(boatProfile: BoatProfile | null): Option {
  if (!boatProfile) return undefined;
  return {
    label: boatProfile.name,
    value: boatProfile.id,
  };
}

export function BoatProfilePicker() {
  const { boatProfile, setBoatProfile } = useBoatProfile();
  const { data: boatProfiles } = useBoatProfiles();

  const [newDialogOpen, setNewDialogOpen] = useState(false);

  function handleValueChange(option: Option) {
    if (!option) {
      setBoatProfile(null);
      return;
    }

    if (option.value === '-1') {
      setNewDialogOpen(true);
      return;
    }

    const boatProfile = boatProfiles.find(
      profile => profile.id === option.value
    );
    setBoatProfile(boatProfile ?? null);
  }

  function handleNewProfile(data: BoatProfileFormValues) {
    console.log(data);
  }

  return (
    <View className='w-full'>
      <Label nativeID='boatProfile' className='mb-1'>
        Boat Profile
      </Label>
      <Select
        value={boatProfileToOption(boatProfile) ?? undefined}
        onValueChange={handleValueChange}
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
      <NewBoatProfileDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onFormSubmit={handleNewProfile}
      />
    </View>
  );
}
