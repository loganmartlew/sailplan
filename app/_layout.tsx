import '~/global.css';
import 'react-native-gesture-handler';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DrawerContent } from '~/features/navigation';
import { PortalHost } from '@rn-primitives/portal';
import { setAndroidNavigationBar } from '~/lib/android-navigation-bar';
import { Menu } from '~/lib/icons/Menu';
import { Button, Text } from '~/components/ui';
import { HeaderMenuButton } from '~/features/navigation/HeaderMenuButton';

const LIGHT_THEME: Theme = {
  dark: false,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  dark: true,
  colors: NAV_THEME.dark,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before getting the color scheme.
SplashScreen.preventAutoHideAsync();

const drawerStyles = StyleSheet.create({
  drawerItem: {
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 4,
  },
});

export default function RootLayout() {
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

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
      <StatusBar
        style={isDarkColorScheme ? 'light' : 'dark'}
        backgroundColor={
          isDarkColorScheme
            ? NAV_THEME.dark.background
            : NAV_THEME.light.background
        }
      />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Drawer
          drawerContent={DrawerContent}
          screenOptions={{
            headerLeft: () => (
              <HeaderMenuButton
                color={
                  isDarkColorScheme ? NAV_THEME.dark.text : NAV_THEME.light.text
                }
              />
            ),
            drawerItemStyle: drawerStyles.drawerItem,
          }}
        >
          <Drawer.Screen
            name='index'
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
      </GestureHandlerRootView>
      <PortalHost />
    </ThemeProvider>
  );
}
