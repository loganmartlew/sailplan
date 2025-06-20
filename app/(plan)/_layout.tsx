import { Tabs } from 'expo-router';
import { Map } from '~/lib/icons/Map';
import { Navigation } from '~/lib/icons/Navigation';

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name='(leg)'
        options={{
          title: 'Leg',
          tabBarIcon: ({ color, size }) => (
            <Navigation color={color} size={size - 3} />
          ),
        }}
      />
      <Tabs.Screen
        name='course'
        options={{
          title: 'Course',
          tabBarIcon: ({ color, size }) => (
            <Map color={color} size={size - 3} />
          ),
        }}
      />
    </Tabs>
  );
}
