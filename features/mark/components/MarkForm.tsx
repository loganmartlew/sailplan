import { zodResolver } from '@hookform/resolvers/zod';
import { set, SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { TextInput, NumberInput } from '~/components/form';
import { Button, Input, Text } from '~/components/ui';
import { useForm } from '~/hooks/useForm';

const markFormSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
  latitude: z.number({ message: 'Latitude is required', coerce: true }),
  longitude: z.number({ message: 'Longitude is required', coerce: true }),
});

export type MarkFormValues = z.infer<typeof markFormSchema>;

const defaultValues: Partial<MarkFormValues> = {
  name: '',
  latitude: 0,
  longitude: 0,
};

interface MarkFormProps {
  onFormSubmit: (data: MarkFormValues) => void;
  markValues?: Partial<MarkFormValues>;
}

export function MarkForm({ onFormSubmit, markValues }: MarkFormProps) {
  const [Form, { handleSubmit, reset, watch, setValue }] =
    useForm<MarkFormValues>({
      resolver: zodResolver(markFormSchema),
      defaultValues: {
        ...defaultValues,
        ...markValues,
      },
    });

  const onSubmit: SubmitHandler<MarkFormValues> = data => {
    onFormSubmit(data);
    reset(defaultValues);
  };

  return (
    <Form className='flex gap-5 grow'>
      <TextInput name='name' label='Name' required />
      <NumberInput name='latitude' label='Latitude' required />
      <NumberInput name='longitude' label='Longitude' required />
      <View className='grow' />
      <Button onPress={handleSubmit(onSubmit)}>
        <Text>Save Mark</Text>
      </Button>
    </Form>
  );
}
