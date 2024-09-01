import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { TestNavLinks } from '@/components/TestNavLinks';

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>Calculate</Text>
      <TestNavLinks />
    </View>
  );
}