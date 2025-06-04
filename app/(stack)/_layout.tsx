import { Stack } from 'expo-router/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '~/components/BackButton';

export default function StackLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerLeft: () => <BackButton />,
        }}
      />
    </SafeAreaView>
  );
}
