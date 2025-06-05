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
          title: 'Marks',
          headerLeft: ({ tintColor }) => (
            <DrawerToggleButton tintColor={tintColor} />
          ),
        }}
      />
      <Stack.Screen
        name='new'
        options={{
          title: 'New Mark',
        }}
      />
      <Stack.Screen
        name='[markId]'
        options={{
          title: 'Mark',
        }}
      />
      <Stack.Screen
        name='map'
        options={{
          title: 'Mark Map',
        }}
      />
    </Stack>
  );
}
