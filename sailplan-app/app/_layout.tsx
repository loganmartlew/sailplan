import '~/global.css';
import 'react-native-gesture-handler';

import { SplashScreen, Tabs } from 'expo-router';
import * as React from 'react';
import { Linking, View } from 'react-native';
import { DARK_THEME, LIGHT_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import { useAppTheme } from '~/hooks/useAppTheme';
import { AppProviders } from '~/components/AppProviders';
import { MigrationGate } from '~/components/MigrationGate';
import { BoatProfileGate } from '~/features/boatProfile/components/BoatProfileGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { ChartGantt, MapPin, Route, Sailboat, Settings } from '~/lib/icons';
import {
  CAPTURE_DISMISS_ACTION,
  CAPTURE_RESUME_ACTION,
  CaptureRecordingBar,
  captureNotificationData,
  captureStopSessionId,
  configureCaptureNotifications,
  dismissCaptureNotification,
  dismissCaptureResume,
  getPlotterSetup,
  getResumableCaptureSession,
  recordingEndpoint,
  useCaptureRecordingStore,
} from '~/features/capture';
import * as Notifications from 'expo-notifications';

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

  React.useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const sessionId = captureStopSessionId(url);
      const state = useCaptureRecordingStore.getState();
      if (sessionId !== null && state.recording?.sessionId === sessionId) {
        void state.stop();
      }
    };
    const subscription = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });
    return () => subscription.remove();
  }, []);

  React.useEffect(() => {
    void configureCaptureNotifications().catch(() => undefined);

    const handleResponse = async (
      response: Notifications.NotificationResponse,
    ) => {
      const data = captureNotificationData(response);
      if (!data) return;
      const notificationId = response.notification.request.identifier;
      if (response.actionIdentifier === CAPTURE_DISMISS_ACTION) {
        await dismissCaptureResume(data.captureSessionId);
        await dismissCaptureNotification(notificationId);
        return;
      }
      if (response.actionIdentifier !== CAPTURE_RESUME_ACTION) return;

      const session = await getResumableCaptureSession(data.captureSessionId);
      if (!session) {
        await dismissCaptureNotification(notificationId);
        return;
      }
      const setup = await getPlotterSetup(session.boatProfileId);
      const endpoint = recordingEndpoint(setup);
      if (!endpoint) return;
      await useCaptureRecordingStore.getState().resume(session, endpoint);
      await dismissCaptureNotification(notificationId);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => void handleResponse(response).catch(() => undefined),
    );
    const initial = Notifications.getLastNotificationResponse();
    if (initial) {
      void handleResponse(initial).finally(() =>
        Notifications.clearLastNotificationResponse(),
      );
    }
    return () => subscription.remove();
  }, []);

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <MigrationGate>
        <BoatProfileGate>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Tabs
              // The capture layer is app chrome, not a screen: it floats over
              // content above the tab bar on every tab, and renders nothing
              // when no recording is running.
              tabBar={props => (
                <View>
                  <CaptureRecordingBar />
                  <BottomTabBar {...props} />
                </View>
              )}
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
