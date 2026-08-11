import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type CaptureForegroundServiceModule = {
  start: (sessionId: number) => Promise<void>;
  stop: () => Promise<void>;
};

const nativeService = NativeModules.CaptureForegroundService as
  | CaptureForegroundServiceModule
  | undefined;

export async function startCaptureForegroundService(sessionId: number) {
  if (Platform.OS !== 'android') return;
  if (Number(Platform.Version) >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Allow recording notifications to start capture');
    }
  }
  if (!nativeService) {
    throw new Error('Capture foreground service is unavailable in this build');
  }
  await nativeService.start(sessionId);
}

export async function stopCaptureForegroundService() {
  if (Platform.OS !== 'android' || !nativeService) return;
  await nativeService.stop();
}
