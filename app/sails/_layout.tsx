import { DrawerToggleButton } from '@react-navigation/drawer';
import { Stack } from 'expo-router';
import { BoatProfileLabel } from '~/features/navigation';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerRight: () => <BoatProfileLabel />,
      }}
    >
      <Stack.Screen
        name='index'
        options={{
          title: 'Sails',
          headerLeft: ({ tintColor }) => (
            <DrawerToggleButton tintColor={tintColor} />
          ),
        }}
      />
      <Stack.Screen
        name='new'
        options={{
          title: 'New Sail',
        }}
      />
      <Stack.Screen
        name='[sailId]'
        options={{
          title: 'Sail',
        }}
      />
    </Stack>
  );
}
