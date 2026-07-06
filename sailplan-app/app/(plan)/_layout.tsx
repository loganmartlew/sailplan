import { useTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { BoatProfileLabel } from '~/features/navigation';

export default function Layout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerRight: () => <BoatProfileLabel />,
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
      <Stack.Screen
        name='course/leg'
        options={{
          title: 'Leg Details',
        }}
      />
    </Stack>
  );
}
