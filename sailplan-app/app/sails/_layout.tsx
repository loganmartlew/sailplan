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
          title: 'Sails',
        }}
      />
      <Stack.Screen
        name='new'
        options={{
          title: 'New Sail',
        }}
      />
      <Stack.Screen
        name='[sailId]/index'
        options={{
          title: 'Sail',
        }}
      />
      <Stack.Screen
        name='[sailId]/twa-limits'
        options={{
          title: 'Sail',
        }}
      />
      <Stack.Screen
        name='[sailId]/polar-chart'
        options={{
          title: 'Polar Chart',
        }}
      />
    </Stack>
  );
}
