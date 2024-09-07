import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { H2, Separator } from '~/components/ui';
import { SailForm, SailFormValues, updateSail, useSail } from '~/features/sail';

export default function SailDetails() {
  const { sailId } = useLocalSearchParams<{ sailId: string }>();
  const { data: sail } = useSail(parseInt(sailId));

  const onFormSubmit = async (data: SailFormValues) => {
    if (!sail) {
      return;
    }

    await updateSail(sail.id, {
      name: data.name,
      color: data.color,
      sailArea: data.sailArea,
      symmetrical: data.symmetrical === 'symmetrical',
    });

    router.navigate('/(drawer)/sails');
  };

  if (!sail) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className='p-7 flex gap-5 h-full'>
      <Stack.Screen options={{ title: 'Sails' }} />
      <H2>{sail.name}</H2>
      <Separator />
      <SailForm
        onFormSubmit={onFormSubmit}
        sailValues={{
          name: sail.name,
          color: sail.color,
          sailArea: sail.sailArea ?? undefined,
          symmetrical: sail.symmetrical ? 'symmetrical' : 'asymmetrical',
        }}
      />
    </View>
  );
}
