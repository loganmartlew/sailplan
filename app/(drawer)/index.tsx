import { SubmitHandler } from 'react-hook-form';
import { View } from 'react-native';
import { Option, SelectInput, TextInput } from '~/components/form';
import { Button, H2, Text } from '~/components/ui';
import { Coordinate, coordsToBearing, getTwa } from '~/features/coordinate';
import { Mark, useMarks } from '~/features/mark';
import { useForm } from '~/hooks/useForm';

function markToCoords(mark: Mark): Coordinate {
  return {
    latitude: mark.latitude,
    longitude: mark.longitude,
  };
}

interface PlanForm {
  tws: number;
  twd: number;
  from: Option;
  to: Option;
}

export default function Index() {
  const { data: marks } = useMarks();

  const [Form, { handleSubmit }] = useForm<PlanForm>({
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
        <H2 className='text-center'>Find a Sail</H2>
        <TextInput<PlanForm>
          label='True Wind Speed (kn)'
          name='tws'
          placeholder='14'
        />
        <TextInput<PlanForm>
          label='True Wind Direction (°)'
          name='twd'
          placeholder='150'
        />
        <SelectInput<PlanForm> label='From' name='from' options={markOptions} />
        <SelectInput<PlanForm> label='To' name='to' options={markOptions} />
        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Find</Text>
        </Button>
      </Form>
    </View>
  );
}
