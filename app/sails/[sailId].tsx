import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, H2 } from '~/components/ui';
import {
  SailDetails,
  SailForm,
  SailFormValues,
  updateSail,
  useSail,
  SailPolars,
} from '~/features/sail';
import { Pencil } from '~/lib/icons';

export default function SailDetailsPage() {
  const { sailId, edit } = useLocalSearchParams<{
    sailId: string;
    edit?: string;
  }>();
  const { data: sail } = useSail(parseInt(sailId));

  const [editMode, setEditMode] = useState(!!edit);

  const onFormSubmit = async (data: SailFormValues) => {
    if (!sail) {
      return;
    }

    await updateSail(sail.id, {
      name: data.name,
      color: data.color,
      sailArea: data.sailArea,
      symmetrical: data.symmetrical === 'symmetrical',
      masthead: data.masthead === 'masthead',
    });

    if (!!edit) {
      router.dismissTo('/sails');
    } else {
      setEditMode(false);
    }
  };

  const onFormCancel = () => {
    if (!!edit) {
      router.dismissTo('/sails');
    } else {
      setEditMode(false);
    }
  };

  if (!sail) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  const editSlot = (
    <SailForm
      onFormSubmit={onFormSubmit}
      onFormCancel={onFormCancel}
      sailValues={{
        name: sail.name,
        color: sail.color,
        sailArea: sail.sailArea ?? undefined,
        symmetrical: sail.symmetrical ? 'symmetrical' : 'asymmetrical',
        masthead: sail.masthead ? 'masthead' : 'fractional',
      }}
    />
  );

  const detailsSlot = (
    <>
      <SailDetails sail={sail} />
      <SailPolars sail={sail} />
    </>
  );

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-6'>
      <View className='flex-row items-center justify-between'>
        <H2 className='pb-0'>{sail.name}</H2>
        {!editMode && (
          <Button variant='ghost' size='icon' onPress={() => setEditMode(true)}>
            <Pencil className='text-muted-foreground' size={16} />
          </Button>
        )}
      </View>
      {editMode ? editSlot : detailsSlot}
    </View>
  );
}
