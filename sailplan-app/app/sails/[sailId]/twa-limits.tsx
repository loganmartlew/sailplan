import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { z } from 'zod';
import { StepperNumberInput } from '~/components/form';
import { Button, H2, Label, Muted, Text } from '~/components/ui';
import { updateSail, useSail } from '~/features/sail';
import {
  ensureSailTwaLimits,
  SailTwaLimit,
  upsertSailTwaLimits,
  useSailTwaLimits,
  TWS_VALUES,
} from '~/features/sailTwaLimit';
import { useForm } from '~/hooks/useForm';
import type { Sail } from '~/features/sail';
import type { SpeedUnit } from '~/features/settings';
import { useSettings } from '~/features/settings';
import {
  convertSpeed,
  DEFAULT_SPEED_UNIT,
  formatAngle,
  formatSpeed,
  getSpeedUnitLabel,
} from '~/lib/format';
import { Pencil } from '~/lib/icons';
import { cn } from '~/lib/utils';
import { useCaptureInset } from '~/features/capture';

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

const formSchema = z
  .object({
    // Wind range is edited in the user's speed unit; converted to knots on save.
    minTws: z.number().min(0).nullable(),
    maxTws: z.number().min(0).nullable(),
    entries: z.array(twaEntrySchema),
  })
  .refine(
    data => data.minTws == null || data.maxTws == null || data.minTws <= data.maxTws,
    { message: 'Min wind must be ≤ Max wind', path: ['minTws'] },
  );

type TwaLimitsFormValues = z.infer<typeof formSchema>;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Convert a stored (knots) wind bound into the user's unit for editing. */
function boundToUnit(kn: number | null, unit: SpeedUnit): number | null {
  return kn != null ? round1(convertSpeed(kn, DEFAULT_SPEED_UNIT, unit)) : null;
}

/** Convert an edited wind bound (user's unit) back to knots for storage. */
function boundToKnots(value: number | null, unit: SpeedUnit): number | null {
  return value != null ? convertSpeed(value, unit, DEFAULT_SPEED_UNIT) : null;
}

/**
 * A grid TWS (knots) is "not used" when it falls outside the entered wind
 * range. The range bounds are in the user's unit, so compare in that unit.
 */
function isTwsOutsideRange(
  twsKn: number,
  minUnit: number | null,
  maxUnit: number | null,
  unit: SpeedUnit,
): boolean {
  const twsUnit = convertSpeed(twsKn, DEFAULT_SPEED_UNIT, unit);
  if (minUnit != null && twsUnit < minUnit) return true;
  if (maxUnit != null && twsUnit > maxUnit) return true;
  return false;
}

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

function buildFormValues(
  sail: Sail,
  twaLimits: SailTwaLimit[],
  unit: SpeedUnit,
): TwaLimitsFormValues {
  return {
    minTws: boundToUnit(sail.minTws, unit),
    maxTws: boundToUnit(sail.maxTws, unit),
    entries: buildEntries(twaLimits),
  };
}

function formatWindRange(
  minKn: number | null,
  maxKn: number | null,
  unit: SpeedUnit,
): string {
  if (minKn == null && maxKn == null) return 'No limit';
  if (minKn == null) return `≤ ${formatSpeed(maxKn!, unit)}`;
  if (maxKn == null) return `≥ ${formatSpeed(minKn, unit)}`;
  return `${formatSpeed(minKn, unit)} – ${formatSpeed(maxKn, unit)}`;
}

function WindStepperInput({
  name,
  label,
  unitLabel,
}: {
  name: 'minTws' | 'maxTws';
  label: string;
  unitLabel: string;
}) {
  return (
    <View className='flex-1'>
      <StepperNumberInput
        name={name}
        label={label}
        onDecrement={v => (v == null ? null : Math.max(0, round1(v - 1)))}
        onIncrement={v => round1((v ?? 0) + 1)}
        decrementLabel='-'
        incrementLabel='+'
        format={v => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
        parse={(v: string) => {
          const trimmed = v.trim();
          if (trimmed === '') return null;
          const n = parseFloat(trimmed);
          return isNaN(n) ? null : Math.max(0, n);
        }}
        endAdornment={<Text className='text-muted-foreground'>{unitLabel}</Text>}
      />
    </View>
  );
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
        onDecrement={v => (v == null || v <= 0 ? null : Math.max(0, v - 5))}
        onIncrement={v => Math.min(180, (v || 0) + 5)}
        decrementLabel='-'
        incrementLabel='+'
        format={v => (v != null ? String(v) : '')}
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
  const captureInset = useCaptureInset();
  const { sailId: sailIdParam } = useLocalSearchParams<{ sailId: string }>();
  const sailId = parseInt(sailIdParam);
  const { data: sail } = useSail(sailId);

  const [editMode, setEditMode] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const { data: twaLimits } = useSailTwaLimits(sailId);
  const { speedUnit } = useSettings();

  const [Form, { handleSubmit, reset, watch }] = useForm<TwaLimitsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      minTws: null,
      maxTws: null,
      entries: TWS_VALUES.map(tws => ({ tws, minTwa: null, maxTwa: null })),
    },
  });

  // Seed rows on mount if needed
  useEffect(() => {
    ensureSailTwaLimits(sailId).then(() => setSeeded(true));
  }, [sailId]);

  // Sync form with live data. Skip while editing so live-query re-renders don't
  // clobber in-progress edits; on save/cancel we drop out of edit mode and the
  // fresh data flows back in.
  useEffect(() => {
    if (!sail || !twaLimits || editMode) return;
    reset(buildFormValues(sail, twaLimits, speedUnit));
  }, [reset, sail, twaLimits, speedUnit, editMode]);

  // Watch the entered wind range so rows grey out live as it's edited.
  const [watchedMin, watchedMax] = watch(['minTws', 'maxTws']);

  const onSubmit: SubmitHandler<TwaLimitsFormValues> = async data => {
    await updateSail(sailId, {
      minTws: boundToKnots(data.minTws, speedUnit),
      maxTws: boundToKnots(data.maxTws, speedUnit),
    });
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
    if (sail && twaLimits) {
      reset(buildFormValues(sail, twaLimits, speedUnit));
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

  const unitLabel = getSpeedUnitLabel(speedUnit);

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col'>
      <View className='flex-row items-center justify-between mb-4'>
        <H2 className='pb-0'>Usable Range</H2>
        {!editMode && (
          <Button variant='ghost' size='icon' onPress={() => setEditMode(true)}>
            <Pencil className='text-muted-foreground' size={16} />
          </Button>
        )}
      </View>

      <Form className='flex-1 flex flex-col'>
        <ScrollView
          className='flex-1'
          contentContainerStyle={{
            paddingBottom: editMode ? 0 : captureInset,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Wind range — is this wind speed on the table at all? */}
          <View className='pb-4 mb-2 border-b border-border gap-2'>
            {editMode ? (
              <>
                <Label className='text-md font-medium text-primary'>
                  Wind range
                </Label>
                <Muted className='text-xs'>
                  Leave a side blank for no limit. Sails are penalised in the
                  suggestions when the wind is outside this range.
                </Muted>
                <View className='flex-row gap-2'>
                  <WindStepperInput
                    name='minTws'
                    label='Min wind'
                    unitLabel={unitLabel}
                  />
                  <WindStepperInput
                    name='maxTws'
                    label='Max wind'
                    unitLabel={unitLabel}
                  />
                </View>
              </>
            ) : (
              <>
                <Label className='text-xs text-muted-foreground'>
                  Wind range
                </Label>
                <Text className='text-base'>
                  {formatWindRange(sail.minTws, sail.maxTws, speedUnit)}
                </Text>
              </>
            )}
          </View>

          {/* Per-TWS angle windows — at this wind speed, which angles? */}
          {TWS_VALUES.map((tws, index) => {
            const limit = twaLimits?.find(l => l.tws === tws);
            const outside = isTwsOutsideRange(
              tws,
              watchedMin,
              watchedMax,
              speedUnit,
            );
            return (
              <View
                key={tws}
                className={cn(
                  'py-3 border-b border-border gap-2',
                  outside && 'opacity-40',
                )}
              >
                <View className='flex-row items-center justify-between'>
                  <Text className='text-md font-medium text-primary'>
                    {formatSpeed(tws, speedUnit)}
                  </Text>
                  {outside && (
                    <Text className='text-xs text-muted-foreground'>
                      Not used
                    </Text>
                  )}
                </View>

                {outside ? null : editMode ? (
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
          <View
            className='pt-4 flex gap-3'
            style={{ paddingBottom: captureInset }}
          >
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
