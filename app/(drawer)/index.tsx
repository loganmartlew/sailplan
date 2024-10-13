import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { Option, SelectInput, TextInput, ToggleGroup } from '~/components/form';
import { Button, H2, Separator, Text } from '~/components/ui';
import { Coordinate, coordsToBearing, getTwa } from '~/features/coordinate';
import { Mark, useMarks } from '~/features/mark';
import { useForm } from '~/hooks/useForm';

function markToCoords(mark: Mark): Coordinate {
  return {
    latitude: mark.latitude,
    longitude: mark.longitude,
  };
}

const planFormSchema = z.object({
  tws: z
    .number({ message: 'TWS must be a number', coerce: true })
    .int()
    .min(0, 'TWS must be greater than 0'),
  twd: z
    .number({ message: 'TWD must be a number', coerce: true })
    .int()
    .min(0, 'TWD must be between 0 and 360')
    .max(360, 'TWD must be between 0 and 360'),
  from: z.object(
    {
      value: z.string(),
    },
    { message: 'From is required' }
  ),
  to: z.object(
    {
      value: z.string(),
    },
    { message: 'To is required' }
  ),
});

type PlanForm = z.infer<typeof planFormSchema>;

export default function Index() {
  const { data: marks } = useMarks();

  const [
    Form,
    {
      handleSubmit,
      watch,
      formState: { errors },
    },
  ] = useForm<PlanForm>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      tws: 0,
      twd: 0,
    },
  });

  const onSubmit: SubmitHandler<PlanForm> = data => {
    const fromMark = marks.find(mark => mark.id === parseInt(data.from.value));
    const toMark = marks.find(mark => mark.id === parseInt(data.to.value));

    if (!fromMark || !toMark) return;

    const fromCoords = markToCoords(fromMark);
    const toCoords = markToCoords(toMark);

    const bearing = coordsToBearing(fromCoords, toCoords);

    const twa = getTwa(data.twd, bearing);

    console.log(twa);
  };

  const markOptions: Option[] = marks?.map(mark => ({
    label: mark.name,
    value: `${mark.id}`,
  }));

  return (
    <View className='flex-1 justify-center items-center'>
      <Form className='w-full px-10 py-5 pb-20 flex flex-col gap-4'>
        <H2>Calculate</H2>
        <Separator />
        <TextInput<PlanForm>
          label='True Wind Speed (kn)'
          name='tws'
          placeholder='14'
          required
        />
        <TextInput<PlanForm>
          label='True Wind Direction (°)'
          name='twd'
          placeholder='150'
          required
        />
        <SelectInput<PlanForm>
          label='From'
          name='from'
          options={markOptions}
          required
        />
        <SelectInput<PlanForm>
          label='To'
          name='to'
          options={markOptions}
          required
        />
        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Find</Text>
        </Button>
      </Form>
    </View>
  );
}
