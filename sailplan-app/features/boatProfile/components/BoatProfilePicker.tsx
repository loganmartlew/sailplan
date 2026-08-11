import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Muted, Text } from '~/components/ui';
import { useBoatProfile } from '../hooks/useBoatProfile';
import { useBoatProfiles } from '../api/getBoatProfiles';
import { useState } from 'react';
import {
  BoatProfileFormValues,
  NewBoatProfileDialog,
} from './NewBoatProfileDialog';
import { BoatProfile } from '../model/boatProfile';
import { createBoatProfile } from '../api/createBoatProfile';
import { FlatList } from 'react-native-gesture-handler';
import { cn } from '~/lib/utils';
import { Sailboat } from '~/lib/icons/Sailboat';
import { Check } from '~/lib/icons/Check';
import { Plus } from '~/lib/icons/Plus';

interface BoatProfilePickerProps {
  onProfileChange?: (profile: BoatProfile) => void;
  onProfileDetails?: () => void;
}

export function BoatProfilePicker({
  onProfileChange,
  onProfileDetails,
}: BoatProfilePickerProps) {
  const { boatProfile, setBoatProfile } = useBoatProfile();
  const { data: boatProfiles } = useBoatProfiles();
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  function handleSelectProfile(profileId: number) {
    const selected = boatProfiles.find(p => p.id === profileId);
    if (selected) {
      setBoatProfile(selected);
      onProfileChange?.(selected);
    }
  }

  async function handleNewProfile(data: BoatProfileFormValues) {
    const newProfile = await createBoatProfile({ name: data.name });
    setBoatProfile(newProfile);
    onProfileChange?.(newProfile);
  }

  return (
    <View className='w-full gap-2'>
      <FlatList
        data={boatProfiles}
        keyExtractor={item => item.id.toString()}
        contentContainerClassName='gap-3'
        renderItem={({ item }) => {
          const isSelected = boatProfile?.id === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => handleSelectProfile(item.id)}
              className={cn('flex-row items-center gap-3 rounded-lg p-3', {
                'bg-secondary': isSelected,
                'active:bg-secondary/50': !isSelected,
              })}
            >
              <Sailboat
                className={cn({
                  'text-primary': isSelected,
                  'text-muted-foreground': !isSelected,
                })}
                size={18}
              />
              <Text
                className={cn('flex-1 text-base', {
                  'font-semibold': isSelected,
                  'font-normal': !isSelected,
                })}
              >
                {item.name}
              </Text>
              {isSelected && <Check className='text-primary' size={18} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-10 gap-2'>
            <Sailboat className='text-muted-foreground' size={32} />
            <Muted>No boat profiles yet</Muted>
          </View>
        }
      />
      <Button
        variant='outline'
        className='flex-row items-center gap-2 mt-1'
        onPress={() => {
          setNewDialogOpen(true);
        }}
      >
        <Plus className='text-primary' size={16} />
        <Text>New Profile</Text>
      </Button>
      {boatProfile && (
        <Button
          variant='outline'
          onPress={() => {
            onProfileDetails?.();
            router.push('/settings/boat-profile');
          }}
        >
          <Text>Configure {boatProfile.name}</Text>
        </Button>
      )}
      <NewBoatProfileDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onFormSubmit={handleNewProfile}
      />
    </View>
  );
}
