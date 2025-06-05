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
          title: 'Plan',
          headerLeft: ({ tintColor }) => (
            <DrawerToggleButton tintColor={tintColor} />
          ),
        }}
      />
      <Stack.Screen
        name='plan'
        options={{
          title: 'Plan Results',
        }}
      />
    </Stack>
  );
}
