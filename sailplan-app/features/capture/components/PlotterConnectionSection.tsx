import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { NumberInput, TextInput } from '~/components/form';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Muted,
  Text,
} from '~/components/ui';
import { useForm } from '~/hooks/useForm';
import {
  markPlotterSetupTested,
  saveManualPlotterSetup,
  usePlotterSetup,
} from '../api/plotterSetup';
import {
  manualPlotterSetupFormSchema,
  type ManualPlotterSetupFormValues,
} from '../model/plotterSetup';
import { openBatteryOptimizationSettings } from '../util/batteryOptimization';
import { openNotificationSettings } from '../util/captureForegroundService';
import { testPlotterConnection } from '../util/testPlotterConnection';

const initialValues: ManualPlotterSetupFormValues = {
  host: '',
  port: 10110,
};

export function PlotterConnectionSection({
  boatProfileId,
}: {
  boatProfileId: number;
}) {
  const { returnToPlan } = useLocalSearchParams<{ returnToPlan?: string }>();
  const { data: setup } = usePlotterSetup(boatProfileId);
  const [Form, { handleSubmit, reset }] =
    useForm<ManualPlotterSetupFormValues>({
      resolver: zodResolver(manualPlotterSetupFormSchema),
      defaultValues: initialValues,
    });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const savedEndpoint = useMemo(
    () =>
      setup?.mode === 'manual' && setup.host !== null && setup.port !== null
        ? { host: setup.host, port: setup.port }
        : null,
    [setup?.host, setup?.mode, setup?.port],
  );

  useEffect(() => {
    reset(savedEndpoint ?? initialValues);
    setTestResult(null);
  }, [boatProfileId, reset, savedEndpoint]);

  async function onSave(values: ManualPlotterSetupFormValues) {
    setIsSaving(true);
    setTestResult(null);
    setSaveError(null);
    try {
      await saveManualPlotterSetup(boatProfileId, values);
      reset(values);
      if (returnToPlan === 'true') router.back();
    } catch {
      // Navigating back on a failed save is the trap worth avoiding: the sailor
      // would land on the course plan believing the plotter is configured, and
      // find out otherwise at the start line.
      setSaveError('Could not save the plotter setup. Retry.');
    } finally {
      setIsSaving(false);
    }
  }

  async function onTestConnection() {
    if (!savedEndpoint) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      await testPlotterConnection(savedEndpoint);
      await markPlotterSetupTested(boatProfileId);
      setTestResult('Connection succeeded');
    } catch (error) {
      setTestResult(
        error instanceof Error ? error.message : 'Connection failed',
      );
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plotter connection</CardTitle>
        <CardDescription>
          Enter the fixed NMEA TCP address for this boat. You can save it before
          the plotter is online.
        </CardDescription>
      </CardHeader>
      <CardContent className='gap-4'>
        <Form className='gap-4'>
          <TextInput<ManualPlotterSetupFormValues>
            label='Host'
            name='host'
            placeholder='192.168.1.1'
            autoCapitalize='none'
            autoCorrect={false}
            required
          />
          <NumberInput<ManualPlotterSetupFormValues>
            label='Port'
            name='port'
            placeholder='10110'
            required
          />
          <Button disabled={isSaving} onPress={handleSubmit(onSave)}>
            <Text>{isSaving ? 'Saving…' : 'Save plotter setup'}</Text>
          </Button>
          {saveError && (
            <Text className='text-sm text-destructive'>{saveError}</Text>
          )}
        </Form>

        <View className='gap-2 border-t border-border pt-4'>
          <Muted>
            {setup?.lastTestedAt
              ? `Last tested successfully ${new Date(
                  setup.lastTestedAt,
                ).toLocaleString()}`
              : 'Not tested'}
          </Muted>
          <Button
            variant='outline'
            disabled={!savedEndpoint || isTesting}
            onPress={onTestConnection}
          >
            <Text>
              {isTesting ? 'Testing connection…' : 'Test connection'}
            </Text>
          </Button>
          {!savedEndpoint && (
            <Muted>Save the address before testing the connection.</Muted>
          )}
          {testResult && <Text className='text-sm'>{testResult}</Text>}
        </View>

        {/*
          Both of these answers are given once, in a system dialog, before the
          first recording — and both become unaskable afterwards: Android stops
          showing the notification prompt after two denials, and the battery
          exemption is asked only once by design. Until `08` can detect a
          declined exemption, this is the only way a sailor who tapped the wrong
          button gets to change their mind.
        */}
        <View className='gap-2 border-t border-border pt-4'>
          <Muted>
            Recording needs SailPlan exempt from battery optimisation — without
            it Android closes the plotter connection a few minutes after the
            screen goes off. The notification is optional; Stop is always
            reachable in the app.
          </Muted>
          <View className='flex-row flex-wrap gap-2'>
            <Button
              variant='outline'
              onPress={() => void openBatteryOptimizationSettings()}
            >
              <Text>Battery settings</Text>
            </Button>
            <Button
              variant='outline'
              onPress={() => void openNotificationSettings()}
            >
              <Text>Notification settings</Text>
            </Button>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}
