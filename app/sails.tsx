import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { TestNavLinks } from '@/components/TestNavLinks';

export default function Sails() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Stack.Screen options={{ title: 'Sails' }} />
      <Text>Sails</Text>
      <TestNavLinks />
    </View>
  );
}
