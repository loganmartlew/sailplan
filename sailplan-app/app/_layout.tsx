import '~/global.css';
import 'react-native-gesture-handler';

import { SplashScreen, Tabs } from 'expo-router';
import * as React from 'react';
import { DARK_THEME, LIGHT_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import { useAppTheme } from '~/hooks/useAppTheme';
import { AppProviders } from '~/components/AppProviders';
import { MigrationGate } from '~/components/MigrationGate';
import { BoatProfileGate } from '~/features/boatProfile/components/BoatProfileGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChartGantt, MapPin, Route, Sailboat, Settings } from '~/lib/icons';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before getting the color scheme.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isColorSchemeLoaded } = useAppTheme();
  const { isDarkColorScheme } = useColorScheme();
  const theme = isDarkColorScheme ? DARK_THEME : LIGHT_THEME;

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <MigrationGate>
        <BoatProfileGate>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Tabs.Screen
                name='(plan)'
                options={{
                  title: 'Plan',
                  tabBarIcon: ({ color, size }) => (
                    <ChartGantt color={color} size={size - 3} />
                  ),
                }}
              />
              <Tabs.Screen
                name='marks'
                options={{
                  title: 'Marks',
                  tabBarIcon: ({ color, size }) => (
                    <MapPin color={color} size={size - 3} />
                  ),
                }}
              />
              <Tabs.Screen
                name='courses'
                options={{
                  title: 'Courses',
                  tabBarIcon: ({ color, size }) => (
                    <Route color={color} size={size - 3} />
                  ),
                }}
              />
              <Tabs.Screen
                name='sails'
                options={{
                  title: 'Sails',
                  tabBarIcon: ({ color, size }) => (
                    <Sailboat color={color} size={size - 3} />
                  ),
                }}
              />
              {/* THROWAWAY — ticket `13` device spike; reachable only by
                  deep link (sailplan://spike), never shown as a tab. */}
              <Tabs.Screen name='spike' options={{ href: null }} />
              <Tabs.Screen
                name='settings'
                options={{
                  title: 'Settings',
                  tabBarIcon: ({ color, size }) => (
                    <Settings color={color} size={size - 3} />
                  ),
                }}
              />
            </Tabs>
          </GestureHandlerRootView>
        </BoatProfileGate>
      </MigrationGate>
    </AppProviders>
  );
}
