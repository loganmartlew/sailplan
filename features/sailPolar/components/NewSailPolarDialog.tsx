import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { View } from 'react-native';
import { z } from 'zod';
import { SelectInput, StepperNumberInput } from '~/components/form';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Muted,
  Option,
  Text,
} from '~/components/ui';
import { useSails } from '~/features/sail';
import { useForm } from '~/hooks/useForm';
import { createSailPolar } from '../api/createSailPolar';

const sailPolarFormSchema = z.object({
  sail: z
    .object({ label: z.string(), value: z.string() })
    .nullable()
    .optional(),
  tws: z
    .number({
      required_error: 'TWS is required',
      invalid_type_error: 'TWS must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'TWS must be greater than 0'),
  twa: z
    .number({
      required_error: 'TWA is required',
      invalid_type_error: 'TWA must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'TWA must be between 0 and 180')
    .max(180, 'TWA must be between 0 and 180'),
  speed: z
    .number({
      required_error: 'Boat speed is required',
      invalid_type_error: 'Boat speed must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'Boat speed must be greater than 0'),
});

type SailPolarFormValues = z.infer<typeof sailPolarFormSchema>;

export interface SailPolarSubmitValues {
  sailId: number;
  tws: number;
  twa: number;
  speed: number;
}

interface NewSailPolarDialogProps {
  /** When provided, the sail selector is hidden and this sailId is used on submit. */
  sailId?: number;
  /** Default TWA value to pre-fill (e.g. from a course leg). */
  defaultTwa?: number;
  /** Default TWS value to pre-fill (e.g. from the plan store). */
  defaultTws?: number;
  onFormSubmit: (data: SailPolarSubmitValues) => void;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

export function NewSailPolarDialog({
  sailId,
  defaultTwa,
  defaultTws,
  open,
  onOpenChange,
  onFormSubmit,
}: NewSailPolarDialogProps) {
  const showSailSelector = sailId == null;
  const sailsQuery = showSailSelector ? useSails() : null;
  const sails = sailsQuery?.data ?? [];

  const sailOptions: Option[] = useMemo(
    () =>
      sails.map(s => ({
        label: s.name,
        value: s.id.toString(),
      })),
    [sails],
  );

  const [Form, { handleSubmit, reset }] = useForm<SailPolarFormValues>({
    resolver: zodResolver(sailPolarFormSchema),
    defaultValues: {
      sail: null,
      speed: 0,
      twa: Math.round(defaultTwa ?? 0),
      tws: Math.round(defaultTws ?? 0),
    },
  });

  function onSubmit(data: SailPolarFormValues) {
    const resolvedSailId = sailId ?? Number(data.sail?.value);
    if (!resolvedSailId) return;

    onFormSubmit({
      sailId: resolvedSailId,
      tws: data.tws,
      twa: data.twa,
      speed: data.speed,
    });
    reset();
    onOpenChange(false);
  }

  function onCancel() {
    reset();
    onOpenChange(false);
  }

  const hasSails = !showSailSelector || sails.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <Form className='flex flex-col gap-5'>
          <DialogHeader>
            <DialogTitle>New Sail Polar</DialogTitle>
            <DialogDescription>
              Enter details to create a new sail polar.
            </DialogDescription>
          </DialogHeader>
          {showSailSelector && (
            <>
              {hasSails ? (
                <SelectInput<SailPolarFormValues>
                  label='Sail'
                  name='sail'
                  options={sailOptions}
                  placeholder='Select a sail'
                  required
                />
              ) : (
                <View className='py-2'>
                  <Muted>
                    No sails found. Create a sail first from the Sails tab.
                  </Muted>
                </View>
              )}
            </>
          )}
          <StepperNumberInput<SailPolarFormValues>
            label='TWS'
            name='tws'
            onDecrement={v => Math.max(0, v - 2)}
            onIncrement={v => v + 2}
            decrementLabel='-2'
            incrementLabel='+2'
            endAdornment={
              <Text className='ml-1 text-muted-foreground'>kt</Text>
            }
          />
          <StepperNumberInput<SailPolarFormValues>
            label='TWA'
            name='twa'
            onDecrement={v => Math.max(0, v - 5)}
            onIncrement={v => Math.min(180, v + 5)}
            decrementLabel='-5°'
            incrementLabel='+5°'
            endAdornment={
              <Text className='ml-1 text-muted-foreground text-xl'>°</Text>
            }
          />
          <StepperNumberInput<SailPolarFormValues>
            label='Boat Speed'
            name='speed'
            onDecrement={v => Math.max(0, v - 1)}
            onIncrement={v => v + 1}
            decrementLabel='-1'
            incrementLabel='+1'
            endAdornment={
              <Text className='ml-1 text-muted-foreground'>kt</Text>
            }
          />
          <DialogFooter>
            <Button variant='outline' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleSubmit(onSubmit)} disabled={!hasSails}>
              <Text>Create Polar</Text>
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
