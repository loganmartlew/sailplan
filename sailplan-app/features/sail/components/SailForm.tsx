import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import {
  ColorPickerInput,
  NumberInput,
  TextInput,
  ToggleGroup,
} from '~/components/form';
import { Button, Text } from '~/components/ui';
import { useForm } from '~/hooks/useForm';
import { convertArea, DEFAULT_AREA_UNIT, getAreaUnitLabel } from '~/lib/format';
import { useSettings } from '~/features/settings';

const SailTypeEnum = z.enum(['asymmetrical', 'symmetrical'], {
  message: 'Sail type is required',
});

const RigTypeEnum = z.enum(['masthead', 'fractional'], {
  message: 'Rig type is required',
});

const sailFormSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
  color: z
    .string({ message: 'Colour is required' })
    .regex(/^#[0-9a-fA-F]{6}$/, 'Valid hex colour is required'),
  sailArea: z
    .number({ message: 'Sail area is must be a number', coerce: true })
    .optional(),
  symmetrical: SailTypeEnum,
  masthead: RigTypeEnum,
});

export type SailFormValues = z.infer<typeof sailFormSchema>;

const defaultValues: Partial<SailFormValues> = {
  name: '',
  color: '#888888',
  sailArea: 0,
  symmetrical: 'symmetrical',
  masthead: 'fractional',
};

interface SailFormProps {
  onFormSubmit: (data: SailFormValues) => void;
  onFormCancel: () => void;
  sailValues?: Partial<SailFormValues>;
}

export function SailForm({
  onFormSubmit,
  onFormCancel,
  sailValues,
}: SailFormProps) {
  const { areaUnit } = useSettings();

  const [Form, { handleSubmit, reset }] = useForm<SailFormValues>({
    resolver: zodResolver(sailFormSchema),
    defaultValues: {
      ...defaultValues,
      ...sailValues,
      ...{
        sailArea: convertArea(
          sailValues?.sailArea ?? defaultValues.sailArea!,
          DEFAULT_AREA_UNIT,
          areaUnit,
        ),
      },
    },
  });

  const onSubmit: SubmitHandler<SailFormValues> = data => {
    onFormSubmit({
      ...data,
      sailArea: data.sailArea
        ? convertArea(data.sailArea, areaUnit, DEFAULT_AREA_UNIT)
        : undefined,
    });
    reset(defaultValues);
  };

  const onCancel = () => {
    onFormCancel();
    reset(defaultValues);
  };

  return (
    <Form className='flex gap-5 grow'>
      <TextInput name='name' label='Name' placeholder='Sail name' required />
      <ColorPickerInput name='color' label='Colour' required />
      <NumberInput
        name='sailArea'
        label='Sail Area'
        placeholder={`Sail area in ${getAreaUnitLabel(areaUnit)}`}
        endAdornment={
          <Text className='ml-1 text-muted-foreground'>
            {getAreaUnitLabel(areaUnit)}
          </Text>
        }
      />
      <ToggleGroup
        name='symmetrical'
        label='Sail Type'
        options={[
          { label: 'Symmetrical', value: 'symmetrical' },
          { label: 'Asymmetrical', value: 'asymmetrical' },
        ]}
        growChildren
      />
      <ToggleGroup
        name='masthead'
        label='Rig Type'
        options={[
          { label: 'Fractional', value: 'fractional' },
          { label: 'Masthead', value: 'masthead' },
        ]}
        growChildren
      />
      <View className='grow' />
      <Button onPress={handleSubmit(onSubmit)}>
        <Text>Save Sail</Text>
      </Button>
      <Button variant='secondary' onPress={onCancel}>
        <Text>Cancel</Text>
      </Button>
    </Form>
  );
}
