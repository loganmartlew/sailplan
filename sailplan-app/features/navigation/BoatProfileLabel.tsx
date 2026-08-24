import { useState } from 'react';
import { Pressable } from 'react-native';
import { Badge, Text } from '~/components/ui';
import { useBoatProfile } from '../boatProfile';
import { BoatProfilePickerDialog } from '../boatProfile/components/BoatProfilePickerDialog';
import { Sailboat } from '~/lib/icons';

export function BoatProfileLabel() {
  const { boatProfile } = useBoatProfile();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!boatProfile) {
    return null;
  }

  return (
    <>
      <Badge
        variant='secondary'
        // The one pressable badge, so it asks for the press feedback the
        // variants no longer carry.
        className='flex-row items-center gap-2 active:opacity-80'
        asChild
      >
        <Pressable onPress={() => setPickerOpen(true)}>
          <Sailboat className='text-primary' size={16} />
          <Text className='text-md font-normal'>{boatProfile.name}</Text>
        </Pressable>
      </Badge>
      <BoatProfilePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}
