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
          title: 'Courses',
        }}
      />
      <Stack.Screen
        name='courseGroups/[courseGroupId]'
        options={{
          title: 'Courses',
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
