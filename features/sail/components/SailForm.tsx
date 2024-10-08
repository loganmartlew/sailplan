import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { NumberInput, TextInput, ToggleGroup } from '~/components/form';
import { Button, Text } from '~/components/ui';
import { useForm } from '~/hooks/useForm';

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
    .min(1, 'Colour is required'),
  sailArea: z
    .number({ message: 'Sail area is must be a number', coerce: true })
    .optional(),
  symmetrical: SailTypeEnum,
  masthead: RigTypeEnum,
});

export type SailFormValues = z.infer<typeof sailFormSchema>;

const defaultValues: Partial<SailFormValues> = {
  name: '',
  color: '',
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
  const [Form, { handleSubmit, reset }] = useForm<SailFormValues>({
    resolver: zodResolver(sailFormSchema),
    defaultValues: {
      ...defaultValues,
      ...sailValues,
    },
  });

  const onSubmit: SubmitHandler<SailFormValues> = data => {
    onFormSubmit(data);
    reset(defaultValues);
  };

  const onCancel = () => {
    onFormCancel();
    reset(defaultValues);
  };

  return (
    <Form className='flex gap-5 grow'>
      <TextInput name='name' label='Name' required />
      <TextInput name='color' label='Colour' required />
      <NumberInput name='sailArea' label='Sail Area' />
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
