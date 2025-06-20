import { View } from 'react-native';
import { Label, Option, Select } from '~/components/ui';
import { useBoatProfile } from '../hooks/useBoatProfile';
import { useBoatProfiles } from '../api/getBoatProfiles';
import { useMemo, useState } from 'react';
import {
  BoatProfileFormValues,
  NewBoatProfileDialog,
} from './NewBoatProfileDialog';
import { useColorScheme } from '~/lib/useColorScheme';
import { BoatProfile } from '../model/boatProfile';
import { createBoatProfile } from '../api/createBoatProfile';

function boatProfileToOption(boatProfile: BoatProfile | null): Option | null {
  if (!boatProfile) return null;
  return {
    label: boatProfile.name,
    value: `${boatProfile.id}`,
  };
}

export function BoatProfilePicker() {
  const { isDarkColorScheme } = useColorScheme();

  const { boatProfile, setBoatProfile } = useBoatProfile();
  const { data: boatProfiles } = useBoatProfiles();

  const [newDialogOpen, setNewDialogOpen] = useState(false);

  function handleValueChange(value: string | null) {
    if (!value) {
      setBoatProfile(null);
      return;
    }

    if (value === '-1') {
      setNewDialogOpen(true);
      return;
    }

    const boatProfile = boatProfiles.find(
      profile => profile.id === parseInt(value)
    );
    setBoatProfile(boatProfile ?? null);
  }

  async function handleNewProfile(data: BoatProfileFormValues) {
    const boatProfile = await createBoatProfile({ name: data.name });
    setBoatProfile(boatProfile);
  }

  const options: Option[] = useMemo(
    () => [
      {
        label: 'New Profile  +',
        value: '-1',
      },
      ...boatProfiles.map(profile => ({
        label: profile.name,
        value: `${profile.id}`,
      })),
    ],
    [boatProfiles, isDarkColorScheme]
  );

  return (
    <View className='w-full'>
      <Label nativeID='boatProfile' className='mb-1'>
        Boat Profile
      </Label>
      <Select
        options={options}
        onValueChange={handleValueChange}
        value={boatProfileToOption(boatProfile)?.value ?? null}
      />
      <NewBoatProfileDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onFormSubmit={handleNewProfile}
      />
    </View>
  );
}
