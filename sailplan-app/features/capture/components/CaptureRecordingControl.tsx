import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { usePlotterSetup } from '../api/plotterSetup';
import { useCaptureRecordingStore } from '../store/captureRecordingStore';
import { captureFailureMessage } from '../util/captureFailureMessage';
import { RecordIcon } from './RecordIcon';

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
  courseName,
}: {
  boatProfileId: number;
  courseId: number;
  courseName: string;
}) {
  const { data: setup } = usePlotterSetup(boatProfileId);
  const endpoint = recordingEndpoint(setup);
  const recording = useCaptureRecordingStore(s => s.recording);
  const isConnecting = useCaptureRecordingStore(s => s.isConnecting);
  const start = useCaptureRecordingStore(s => s.start);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const openPlotterSetup = () => {
    router.push({
      pathname: '/settings/boat-profile',
      params: { returnToPlan: 'true' },
    });
  };

  if (recording || !endpoint) return null;

  const startRecording = async () => {
    setFailure(null);
    try {
      await start({ boatProfileId, courseId, endpoint });
    } catch (error) {
      setFailure(captureFailureMessage(error));
    }
  };

  return (
    <>
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start recording?</DialogTitle>
            <DialogDescription>
              Record NMEA data and associate this capture with course “
              {courseName}”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex-row'>
            <Button
              className='flex-1'
              variant='secondary'
              onPress={() => setConfirmationOpen(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              className='flex-1'
              onPress={() => {
                setConfirmationOpen(false);
                void startRecording();
              }}
            >
              <Text>Start recording</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={failure !== null}
        onOpenChange={open => {
          if (!open) setFailure(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Could not start recording</DialogTitle>
            <DialogDescription>{failure}</DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
      <Button
        accessibilityLabel='Record this course'
        disabled={isConnecting}
        variant='ghost'
        size='icon'
        onPress={() => setConfirmationOpen(true)}
      >
        {isConnecting ? <ActivityIndicator color='white' /> : <RecordIcon />}
      </Button>
    </>
  );
}
