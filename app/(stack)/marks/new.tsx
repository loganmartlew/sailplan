import { Stack } from 'expo-router';
import { View } from 'react-native';
import { H2, Separator } from '~/components/ui';
import { MarkForm } from '~/features/mark';

export default function NewMark() {
  return (
    <View className='p-7 flex gap-5 h-full'>
      <Stack.Screen options={{ title: 'Marks' }} />
      <H2>New Mark</H2>
      <Separator />
      <MarkForm />
    </View>
  );
}
