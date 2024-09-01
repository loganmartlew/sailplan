import 'react-native-gesture-handler';
import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { DrawerContent } from '@/features/navigation';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer drawerContent={DrawerContent}>
        <Drawer.Screen
          name='index'
          options={{
            drawerLabel: 'Plan',
            title: 'Plan',
          }}
        />
        <Drawer.Screen
          name='sails'
          options={{
            drawerLabel: 'Sails',
            title: 'Sails',
          }}
        />
        <Drawer.Screen
          name='marks'
          options={{
            drawerLabel: 'Marks',
            title: 'Marks',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
