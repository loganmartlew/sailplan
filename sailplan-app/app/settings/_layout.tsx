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
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name='units'
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name='boat-profile'
        options={{
          title: 'Boat Profile',
        }}
      />
      <Stack.Screen
        name='defaults'
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name='appearance'
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name='about'
        options={{
          title: 'Settings',
        }}
      />
    </Stack>
  );
}
