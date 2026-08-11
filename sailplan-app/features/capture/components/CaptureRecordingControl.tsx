import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, CardContent, Text } from '~/components/ui';
import { usePlotterSetup } from '../api/plotterSetup';
import { beginCaptureRecording } from '../util/captureRecordingManager';

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

function failureMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : 'Connection failed';
  if (/timed out|timeout|no route|network is unreachable/i.test(detail)) {
    return 'SailPlan cannot reach the boat network. Connect to the boat Wi-Fi, then retry. On a fresh Android install, accept the system stay connected prompt.';
  }
  return `You are on Wi-Fi, but the plotter was not found at the saved address. ${detail}`;
}

export function CaptureRecordingControl({
  boatProfileId,
  courseId,
}: {
  boatProfileId: number;
  courseId: number;
}) {
  const { data: setup } = usePlotterSetup(boatProfileId);
  const endpoint = recordingEndpoint(setup);
  const [isConnecting, setIsConnecting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const openPlotterSetup = () => {
    router.push({
      pathname: '/settings/boat-profile',
      params: { returnToPlan: 'true' },
    });
  };

  const startRecording = async () => {
    if (!endpoint) return;
    setIsConnecting(true);
    setFailure(null);
    try {
      await beginCaptureRecording({ boatProfileId, courseId, endpoint });
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setIsConnecting(false);
    }
  };

  if (!endpoint) {
    return (
      <Card>
        <CardContent className='pt-6 gap-3'>
          <Text className='text-sm text-muted-foreground'>
            Set up this boat&apos;s plotter connection before recording.
          </Text>
          <Button onPress={openPlotterSetup}>
            <Text>Set up plotter</Text>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <View className='gap-3'>
      <Button disabled={isConnecting} onPress={startRecording}>
        <Text>{isConnecting ? 'Connecting to plotter…' : 'Record this course'}</Text>
      </Button>
      {failure && (
        <Card>
          <CardContent className='pt-6 gap-3'>
            <Text>{failure}</Text>
            <View className='flex-row flex-wrap gap-2'>
              <Button variant='outline' disabled={isConnecting} onPress={startRecording}>
                <Text>Retry</Text>
              </Button>
              <Button
                variant='outline'
                onPress={() => Linking.sendIntent('android.settings.WIFI_SETTINGS')}
              >
                <Text>Open Wi-Fi settings</Text>
              </Button>
              <Button variant='outline' onPress={openPlotterSetup}>
                <Text>Plotter setup</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );
}
