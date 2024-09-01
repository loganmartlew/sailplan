import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { TestNavLinks } from '@/components/TestNavLinks';

export default function Marks() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Stack.Screen options={{ title: 'Marks' }} />
      <Text>Marks</Text>
      <TestNavLinks />
    </View>
  );
}
