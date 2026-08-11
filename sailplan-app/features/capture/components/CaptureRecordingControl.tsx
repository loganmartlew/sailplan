import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Button, Card, CardContent, Text } from '~/components/ui';
import { CircleSmall, Settings, X } from '~/lib/icons';
import { usePlotterSetup } from '../api/plotterSetup';
import { useCaptureRecordingStore } from '../store/captureRecordingStore';
import { captureFailureMessage } from '../util/captureFailureMessage';

function recordingEndpoint(setup: ReturnType<typeof usePlotterSetup>['data']) {
  if (!setup) return null;
  if (setup.mode === 'manual' && setup.host && setup.port) {
    return { host: setup.host, port: setup.port };
  }
  if (setup.mode === 'automatic' && setup.cachedHost && setup.cachedPort) {
    return { host: setup.cachedHost, port: setup.cachedPort };
  }
  return null;
}

/**
 * The course plan's entry point into recording. Once recording starts the
 * capture layer above the tab bar owns the UI, so this renders nothing.
 */
export function CaptureRecordingControl({
  boatProfileId,
  courseId,
}: {
  boatProfileId: number;
  courseId: number;
}) {
  const { data: setup } = usePlotterSetup(boatProfileId);
  const endpoint = recordingEndpoint(setup);
  const recording = useCaptureRecordingStore(s => s.recording);
  const isConnecting = useCaptureRecordingStore(s => s.isConnecting);
  const start = useCaptureRecordingStore(s => s.start);
  const [failure, setFailure] = useState<string | null>(null);

  const openPlotterSetup = () => {
    router.push({
      pathname: '/settings/boat-profile',
      params: { returnToPlan: 'true' },
    });
  };

  const startRecording = async () => {
    if (!endpoint) return;
    setFailure(null);
    try {
      await start({ boatProfileId, courseId, endpoint });
    } catch (error) {
      setFailure(captureFailureMessage(error));
    }
  };

  if (recording) return null;

  if (!endpoint) {
    return (
      <View className='absolute z-20 bottom-4 right-4'>
        <Button
          className='flex-row gap-2 shadow-lg shadow-foreground/20'
          onPress={openPlotterSetup}
        >
          <Settings className='text-primary-foreground' size={18} />
          <Text>Set up plotter</Text>
        </Button>
      </View>
    );
  }

  return (
    <>
      {failure && (
        <View className='absolute z-30 top-0 bottom-0 left-0 right-0'>
          <Pressable
            accessibilityLabel='Dismiss connection failure'
            className='absolute top-0 bottom-0 left-0 right-0'
            onPress={() => setFailure(null)}
          />
          <Card className='absolute bottom-20 left-4 right-4'>
            <CardContent className='pt-4 gap-3'>
              <View className='flex-row items-start gap-2'>
                <Text className='flex-1'>{failure}</Text>
                <Button
                  accessibilityLabel='Dismiss connection failure'
                  variant='ghost'
                  size='icon'
                  onPress={() => setFailure(null)}
                >
                  <X className='text-muted-foreground' size={18} />
                </Button>
              </View>
              <View className='flex-row flex-wrap gap-2'>
                <Button
                  variant='outline'
                  disabled={isConnecting}
                  onPress={() => void startRecording()}
                >
                  <Text>Retry</Text>
                </Button>
                <Button
                  variant='outline'
                  onPress={() =>
                    Linking.sendIntent('android.settings.WIFI_SETTINGS')
                  }
                >
                  <Text>Open Wi-Fi settings</Text>
                </Button>
                <Button variant='outline' onPress={openPlotterSetup}>
                  <Text>Plotter setup</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>
      )}
      <View className='absolute z-20 bottom-4 right-4'>
        <Button
          accessibilityLabel='Record this course'
          disabled={isConnecting}
          size='icon'
          className='w-14 h-14 shadow-lg shadow-foreground/20'
          onPress={() => void startRecording()}
        >
          {isConnecting ? (
            <ActivityIndicator color='white' />
          ) : (
            <CircleSmall
              className='text-primary-foreground'
              size={34}
              fill='currentColor'
            />
          )}
        </Button>
      </View>
    </>
  );
}
