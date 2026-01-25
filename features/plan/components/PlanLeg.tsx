import { useRouter } from 'expo-router';
import { NumberInput, SelectInput } from '~/components/form';
import { useMarks } from '~/features/mark';
import { usePlanState } from '../store/planStore';
import { useForm } from '~/hooks/useForm';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler } from 'react-hook-form';
import { LegPlanData, serializeLegPlanData } from '../model/legPlanData';
import { Button, Option, Text } from '~/components/ui';
import { View } from 'react-native';
import z from 'zod';

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

export function PlanLeg() {
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
      pathname: '/leg/plan',
      params: { planData: serializedPlanData },
    });
  };

  const markOptions: Option[] = marks?.map(mark => ({
    label: mark.name,
    value: `${mark.id}`,
  }));

  return (
    <Form className='w-full flex flex-col gap-6'>
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
  );
}
