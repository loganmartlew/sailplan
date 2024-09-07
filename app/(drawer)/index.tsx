import { useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { TextInput } from '~/components/form';
import { Button, H2, Text } from '~/components/ui';
import { useForm } from '~/hooks/useForm';

interface PlanForm {
  tws: number;
  twd: number;
  bearing: number;
}

export default function Index() {
  const [twa, setTwa] = useState<number | null>(null);

  const [Form, { handleSubmit }] = useForm<PlanForm>({
    defaultValues: {
      tws: 0,
      twd: 0,
    },
  });

  const onSubmit: SubmitHandler<PlanForm> = data => {
    const { bearing, twd } = data;

    let twa = Math.abs(twd - bearing);
    if (twa > 180) {
      twa = twa - 180;
    }
    setTwa(twa);
  };

  return (
    <View className='flex-1 justify-center items-center'>
      <Form className='w-full px-10 py-5 pb-20 flex flex-col gap-4'>
        <H2 className='text-center'>Find a Sail</H2>
        <TextInput<PlanForm>
          label='True Wind Speed'
          name='tws'
          placeholder='14'
        />
        <TextInput<PlanForm>
          label='True Wind Direction'
          name='twd'
          placeholder='150'
        />
        <TextInput<PlanForm> label='Bearing' name='bearing' placeholder='150' />
        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Find</Text>
        </Button>
        {twa && <Text className='text-center'>TWA: {twa} degrees</Text>}
      </Form>
    </View>
  );
}
