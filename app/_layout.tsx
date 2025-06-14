import '~/global.css';
import 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import { PortalHost } from '@rn-primitives/portal';
import { setAndroidNavigationBar } from '~/lib/android-navigation-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BoatProfileProvider } from '~/features/boatProfile/context/BoatProfileContext';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '~/drizzle/migrations';
import { db, expoDb } from '~/lib/db';
import { H2, Text } from '~/components/ui';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { BoatProfilePicker, useBoatProfile } from '~/features/boatProfile';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Drawer from 'expo-router/drawer';
import { BoatProfileLabel, DrawerContent } from '~/features/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';

const LIGHT_THEME: Theme = {
  dark: false,
  colors: NAV_THEME.light,
  fonts: DefaultTheme.fonts,
};
const DARK_THEME: Theme = {
  dark: true,
  colors: NAV_THEME.dark,
  fonts: DefaultTheme.fonts,
};

const getErrorStyles = (isDarkColorScheme: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDarkColorScheme
        ? NAV_THEME.dark.background
        : NAV_THEME.light.background,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before getting the color scheme.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayoutLogic() {
  const { success, error } = useMigrations(db, migrations);
  useDrizzleStudio(expoDb);

  const { colorScheme, setColorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const theme = await AsyncStorage.getItem('theme');
      if (Platform.OS === 'web') {
        // Adds the background color to the html element to prevent white background on overscroll.
        document.documentElement.classList.add('bg-background');
      }
      if (!theme) {
        setAndroidNavigationBar(colorScheme);
        AsyncStorage.setItem('theme', colorScheme);
        setIsColorSchemeLoaded(true);
        return;
      }
      const colorTheme = theme === 'dark' ? 'dark' : 'light';
      setAndroidNavigationBar(colorTheme);
      if (colorTheme !== colorScheme) {
        setColorScheme(colorTheme);

        setIsColorSchemeLoaded(true);
        return;
      }
      setIsColorSchemeLoaded(true);
    })().finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  React.useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BoatProfileProvider>
        <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
          <StatusBar
            style={isDarkColorScheme ? 'light' : 'dark'}
            backgroundColor={
              isDarkColorScheme
                ? NAV_THEME.dark.background
                : NAV_THEME.light.background
            }
          />
          {error && (
            <View style={getErrorStyles(isDarkColorScheme).container}>
              <Text>Migration error: {error.message}</Text>
            </View>
          )}
          {!error && !success && (
            <View style={getErrorStyles(isDarkColorScheme).container}>
              <Text>Migration is in progress...</Text>
            </View>
          )}
          {!error && success && <RootLayout />}
          <PortalHost />
        </ThemeProvider>
      </BoatProfileProvider>
    </QueryClientProvider>
  );
}

const drawerStyles = StyleSheet.create({
  drawerItem: {
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 4,
  },
});

function RootLayout() {
  const { isDarkColorScheme } = useColorScheme();
  const { boatProfile } = useBoatProfile();

  if (!boatProfile)
    return (
      <View
        className='flex-1 justify-center items-center px-10 py-5'
        style={{
          backgroundColor: isDarkColorScheme
            ? NAV_THEME.dark.background
            : NAV_THEME.light.background,
        }}
      >
        <H2 className='text-center mb-4'>Select a Boat Profile</H2>
        <BoatProfilePicker />
      </View>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Drawer
          drawerContent={DrawerContent}
          screenOptions={{
            headerShown: false,
            drawerItemStyle: drawerStyles.drawerItem,
          }}
        >
          <Drawer.Screen
            name='(plan)'
            options={{
              title: 'Plan',
            }}
          />
          <Drawer.Screen
            name='sails'
            options={{
              title: 'Sails',
            }}
          />
          <Drawer.Screen
            name='marks'
            options={{
              title: 'Marks',
            }}
          />
        </Drawer>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
