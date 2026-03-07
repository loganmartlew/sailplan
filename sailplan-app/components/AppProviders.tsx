import * as React from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalHost } from '@rn-primitives/portal';
import { BoatProfileProvider } from '~/features/boatProfile/context/BoatProfileContext';
import { SettingsProvider } from '~/features/settings';
import { DARK_THEME, LIGHT_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';

const queryClient = new QueryClient();

export function AppProviders({ children }: React.PropsWithChildren) {
  const { isDarkColorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <BoatProfileProvider>
        <SettingsProvider>
          {/* @ts-expect-error - Module augmentation not picked up */}
          <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
            <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} />
            {children}
            <PortalHost />
          </ThemeProvider>
        </SettingsProvider>
      </BoatProfileProvider>
    </QueryClientProvider>
  );
}
