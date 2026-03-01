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
          title: 'Marks',
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
