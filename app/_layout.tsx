import { Link, Slot, SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return <Stack />;
}
