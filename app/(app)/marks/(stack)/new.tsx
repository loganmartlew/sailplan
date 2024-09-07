import { Stack } from 'expo-router';
import { View } from 'react-native';
import { H2, Separator } from '~/components/ui';

export default function NewMark() {
  return (
    <View className='p-7 flex gap-5'>
      <Stack.Screen options={{ headerShown: false }} />
      <H2>New Mark</H2>
      <Separator />
    </View>
  );
}
