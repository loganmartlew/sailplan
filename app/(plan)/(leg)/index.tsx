import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { SubmitHandler } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { z } from 'zod';
import { NumberInput, SelectInput, TextInput } from '~/components/form';
import { Button, H2, Option, Separator, Text } from '~/components/ui';
import { useMarks } from '~/features/mark';
import {
  LegPlanData,
  serializeLegPlanData,
  usePlanState,
} from '~/features/plan';
import { useForm } from '~/hooks/useForm';

const planLegFormSchema = z.object({
  // tws: z.coerce
  //   .number({ invalid_type_error: 'TWS must be a number' })
  //   .min(0, { message: 'TWS must be a positive number' })
  //   .optional(),
  twd: z
    .string({ required_error: 'TWD is required' })
    .min(1, { message: 'TWD is required' })
    .pipe(
      z.coerce
        .number({
          required_error: 'TWD is required',
          invalid_type_error: 'TWD must be a number',
        })
        .int()
        .min(0, 'TWD must be between 0 and 360')
        .max(360, 'TWD must be between 0 and 360'),
    ),
  from: z.object(
    {
      value: z.string(),
    },
    { message: 'From is required' },
  ),
  to: z.object(
    {
      value: z.string(),
    },
    { message: 'To is required' },
  ),
});

type PlanLegForm = z.infer<typeof planLegFormSchema>;

export default function PlanLegPage() {
  const { data: marks } = useMarks();
  const router = useRouter();
  const { add, currentState } = usePlanState();

  const [Form, { handleSubmit }] = useForm<PlanLegForm>({
    resolver: zodResolver(planLegFormSchema),
    defaultValues: {
      // tws: (currentState?.tws?.toString() as unknown as number) ?? undefined,
      twd: currentState?.twd.toString() as unknown as number | undefined,
    },
  });

  const onSubmit: SubmitHandler<PlanLegForm> = data => {
    const fromMark = marks.find(mark => mark.id === parseInt(data.from.value));
    const toMark = marks.find(mark => mark.id === parseInt(data.to.value));

    if (!fromMark || !toMark) return;

    const planData: LegPlanData = {
      // tws: data.tws,
      twd: data.twd,
      from: fromMark,
      to: toMark,
    };

    const serializedPlanData = serializeLegPlanData(planData);
    add({
      // tws: data.tws ?? null,
      twd: data.twd,
    });

    router.push({
      pathname: '/plan',
      params: { planData: serializedPlanData },
    });
  };

  const markOptions: Option[] = marks?.map(mark => ({
    label: mark.name,
    value: `${mark.id}`,
  }));

  return (
    <ScrollView>
      <View className='flex-1 justify-center items-center'>
        <Form className='w-full px-5 py-5 pb-20 flex flex-col gap-6'>
          <H2>Plan Leg</H2>
          {/* <TextInput<PlanLegForm> label='True Wind Speed (kn)' name='tws' /> */}
          <NumberInput<PlanLegForm>
            label='True Wind Direction (°)'
            placeholder='e.g: 163'
            name='twd'
            required
          />
          <SelectInput<PlanLegForm>
            label='From'
            name='from'
            options={markOptions}
            required
          />
          <SelectInput<PlanLegForm>
            label='To'
            name='to'
            options={markOptions}
            required
          />
          <Button onPress={handleSubmit(onSubmit)} className='mt-3'>
            <Text>Plan</Text>
          </Button>
        </Form>
      </View>
    </ScrollView>
  );
}
