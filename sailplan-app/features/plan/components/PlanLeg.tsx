import { useRouter } from 'expo-router';
import { NumberInput, SelectInput } from '~/components/form';
import { useMarks } from '~/features/mark';
import { useForm } from '~/hooks/useForm';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler } from 'react-hook-form';
import { LegPlanData, serializeLegPlanData } from '../model/legPlanData';
import { Button, Option, Text } from '~/components/ui';
import { z } from 'zod';
import { TrueWindInputCard } from './TrueWindInputCard';

const planLegFormSchema = z.object({
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

  const [Form, { handleSubmit }] = useForm<PlanLegForm>({
    resolver: zodResolver(planLegFormSchema),
  });

  const onSubmit: SubmitHandler<PlanLegForm> = data => {
    const fromMark = marks?.find(mark => mark.id === parseInt(data.from.value));
    const toMark = marks?.find(mark => mark.id === parseInt(data.to.value));

    if (!fromMark || !toMark) return;

    const planData: LegPlanData = {
      from: fromMark,
      to: toMark,
    };

    const serializedPlanData = serializeLegPlanData(planData);

    router.push({
      pathname: '/leg/plan',
      params: { planData: serializedPlanData },
    });
  };

  const markOptions: Option[] =
    marks?.map(mark => ({
      label: mark.name,
      value: `${mark.id}`,
    })) ?? [];

  return (
    <Form className='w-full flex flex-col gap-6'>
      <TrueWindInputCard twd tws />
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
