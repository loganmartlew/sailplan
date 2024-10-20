import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { Option, SelectInput, TextInput } from '~/components/form';
import { Button, H2, Separator, Text } from '~/components/ui';
import { useMarks } from '~/features/mark';
import { PlanData, serializePlanData } from '~/features/plan';
import { useForm } from '~/hooks/useForm';

const planFormSchema = z.object({
  tws: z
    .number({
      required_error: 'TWS is required',
      invalid_type_error: 'TWS must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'TWS must be greater than 0'),
  twd: z
    .number({
      required_error: 'TWD is required',
      invalid_type_error: 'TWD must be a number',
      coerce: true,
    })
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

export default function PlanPage() {
  const { data: marks } = useMarks();
  const router = useRouter();

  const [Form, { handleSubmit }] = useForm<PlanForm>({
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

    const planData: PlanData = {
      tws: data.tws,
      twd: data.twd,
      from: fromMark,
      to: toMark,
    };

    const serializedPlanData = serializePlanData(planData);

    router.push({
      pathname: '/(stack)/plan',
      params: { planData: serializedPlanData },
    });
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
