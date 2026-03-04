import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { z } from 'zod';
import { StepperNumberInput } from '~/components/form';
import { Button, H2, Label, Text } from '~/components/ui';
import { useSail } from '~/features/sail';
import {
  ensureSailTwaLimits,
  SailTwaLimit,
  upsertSailTwaLimits,
  useSailTwaLimits,
  TWS_VALUES,
} from '~/features/sailTwaLimit';
import { useForm } from '~/hooks/useForm';
import { formatAngle } from '~/lib/format';
import { Pencil } from '~/lib/icons';

const twaEntrySchema = z
  .object({
    tws: z.number(),
    minTwa: z.number().int().min(0).max(180).nullable(),
    maxTwa: z.number().int().min(0).max(180).nullable(),
  })
  .refine(
    data => {
      if (data.minTwa != null && data.maxTwa != null) {
        return data.minTwa <= data.maxTwa;
      }
      return true;
    },
    { message: 'Min TWA must be ≤ Max TWA', path: ['minTwa'] },
  );

const formSchema = z.object({
  entries: z.array(twaEntrySchema),
});

type TwaLimitsFormValues = z.infer<typeof formSchema>;

function buildEntries(twaLimits: SailTwaLimit[]) {
  return TWS_VALUES.map(tws => {
    const existing = twaLimits.find(l => l.tws === tws);
    return {
      tws,
      minTwa: existing?.minTwa ?? null,
      maxTwa: existing?.maxTwa ?? null,
    };
  });
}

function TwaStepperInput({
  index,
  field,
  label,
}: {
  index: number;
  field: 'minTwa' | 'maxTwa';
  label: string;
}) {
  return (
    <View className='flex-1'>
      <StepperNumberInput
        name={`entries.${index}.${field}`}
        label={label}
        onDecrement={(v: number | null) =>
          v == null || v <= 0 ? null : Math.max(0, v - 5)
        }
        onIncrement={(v: number | null) => Math.min(180, (v || 0) + 5)}
        decrementLabel='-'
        incrementLabel='+'
        format={(v: number | null) => (v != null ? String(v) : '')}
        parse={(v: string) => {
          const trimmed = v.trim();
          if (trimmed === '') return null;
          const n = parseInt(trimmed, 10);
          return isNaN(n) ? null : Math.min(180, Math.max(0, n));
        }}
        endAdornment={<Text className='text-muted-foreground'>°</Text>}
      />
    </View>
  );
}

function TwaDisplayField({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <View className='flex-1'>
      <Label className='text-xs text-muted-foreground'>{label}</Label>
      <Text className='text-base'>
        {value != null ? formatAngle(value) : '—'}
      </Text>
    </View>
  );
}

export default function TwaLimitsPage() {
  const { sailId: sailIdParam } = useLocalSearchParams<{ sailId: string }>();
  const sailId = parseInt(sailIdParam);
  const { data: sail } = useSail(sailId);

  const [editMode, setEditMode] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const { data: twaLimits } = useSailTwaLimits(sailId);

  const [Form, { handleSubmit, reset }] = useForm<TwaLimitsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entries: TWS_VALUES.map(tws => ({ tws, minTwa: null, maxTwa: null })),
    },
  });

  // Seed rows on mount if needed
  useEffect(() => {
    ensureSailTwaLimits(sailId).then(() => setSeeded(true));
  }, [sailId]);

  // Sync form with live data
  useEffect(() => {
    if (twaLimits && twaLimits.length > 0) {
      reset({ entries: buildEntries(twaLimits) });
    }
  }, [twaLimits]);

  const onSubmit: SubmitHandler<TwaLimitsFormValues> = async data => {
    await upsertSailTwaLimits(
      sailId,
      data.entries.map(e => ({
        tws: e.tws,
        minTwa: e.minTwa,
        maxTwa: e.maxTwa,
      })),
    );
    setEditMode(false);
  };

  const onCancel = () => {
    if (twaLimits && twaLimits.length > 0) {
      reset({ entries: buildEntries(twaLimits) });
    }
    setEditMode(false);
  };

  if (!sail || !seeded) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col'>
      <View className='flex-row items-center justify-between mb-4'>
        <H2 className='pb-0'>TWA Limits</H2>
        {!editMode && (
          <Button variant='ghost' size='icon' onPress={() => setEditMode(true)}>
            <Pencil className='text-muted-foreground' size={16} />
          </Button>
        )}
      </View>

      <Form className='flex-1 flex flex-col'>
        <ScrollView className='flex-1' showsVerticalScrollIndicator={false}>
          {TWS_VALUES.map((tws, index) => {
            const limit = twaLimits?.find(l => l.tws === tws);
            return (
              <View key={tws} className='py-3 border-b border-border gap-2'>
                <Text className='text-md font-medium text-primary'>
                  {tws} kt
                </Text>

                {editMode ? (
                  <View className='flex-row gap-2'>
                    <TwaStepperInput
                      index={index}
                      field='minTwa'
                      label='Min TWA'
                    />
                    <TwaStepperInput
                      index={index}
                      field='maxTwa'
                      label='Max TWA'
                    />
                  </View>
                ) : (
                  <View className='flex-row gap-4'>
                    <TwaDisplayField label='Min TWA' value={limit?.minTwa} />
                    <TwaDisplayField label='Max TWA' value={limit?.maxTwa} />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {editMode && (
          <View className='pt-4 flex gap-3'>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>Save</Text>
            </Button>
            <Button variant='secondary' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
          </View>
        )}
      </Form>
    </View>
  );
}
