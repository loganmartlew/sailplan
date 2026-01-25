import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Layout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: true,
        }}
      >
        <Stack.Screen
          name='index'
          options={{
            title: 'Plan',
          }}
        />
        <Stack.Screen
          name='leg/plan'
          options={{
            title: 'Leg Plan',
          }}
        />
        <Stack.Screen
          name='leg/map'
          options={{
            title: 'Leg Map',
          }}
        />
        <Stack.Screen
          name='course/plan'
          options={{
            title: 'Course Plan',
          }}
        />
      </Stack>
    </SafeAreaView>
  );
}
