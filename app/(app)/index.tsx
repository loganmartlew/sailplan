import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { FormInput } from '~/components/form';
import { Button, H2, Text } from '~/components/ui';
import { useForm } from '~/hooks/useForm';

interface PlanForm {
  tws: number;
  twa: number;
}

export default function Index() {
  const [Form, { handleSubmit }] = useForm<PlanForm>({
    defaultValues: {
      tws: 0,
      twa: 0,
    },
  });

  const onSubmit: SubmitHandler<PlanForm> = data => {
    console.log(data);
  };

  return (
    <View className='flex-1 justify-center items-center'>
      <Form className='w-full px-10 py-5 pb-20 flex flex-col gap-4'>
        <H2 className='text-center'>Find a Sail</H2>
        <FormInput<PlanForm>
          label='True Wind Speed'
          name='tws'
          placeholder='14'
        />
        <FormInput<PlanForm>
          label='True Wind Angle'
          name='twa'
          placeholder='150'
        />
        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Find</Text>
        </Button>
      </Form>
    </View>
  );
}
