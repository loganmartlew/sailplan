import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
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
  const { data: setup } = usePlotterSetup(boatProfileId);
  const [Form, { handleSubmit, reset }] =
    useForm<ManualPlotterSetupFormValues>({
      resolver: zodResolver(manualPlotterSetupFormSchema),
      defaultValues: initialValues,
    });
  const [isSaving, setIsSaving] = useState(false);
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
    try {
      await saveManualPlotterSetup(boatProfileId, values);
      reset(values);
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
      </CardContent>
    </Card>
  );
}
