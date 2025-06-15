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
          title: 'Courses',
          headerLeft: ({ tintColor }) => (
            <DrawerToggleButton tintColor={tintColor} />
          ),
        }}
      />
      <Stack.Screen
        name='(course)/new'
        options={{
          title: 'New Course',
        }}
      />
      <Stack.Screen
        name='(course)/[courseId]'
        options={{
          title: 'Course',
        }}
      />
    </Stack>
  );
}
