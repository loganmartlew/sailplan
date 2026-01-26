import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { H2, Text, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { PlanCourse, PlanLeg } from '~/features/plan';

export default function PlanPage() {
  const [planMode, setPlanMode] = useState<'leg' | 'course'>('leg');

  // const router = useRouter();
  // router.replace({
  //   pathname: '/leg/plan',
  //   params: {
  //     planData:
  //       '{"from":{"id":16,"name":"Bastion","latitude":-36.84016667,"longitude":174.82266667},"to":{"id":2,"name":"Bayswater","latitude":-36.82966667,"longitude":174.76283333}}',
  //   },
  // });

  return (
    <View className='flex-1 w-full px-3 py-5 pb-20 flex flex-col gap-6'>
      <H2>Plan Legs</H2>
      <ToggleGroup
        type='single'
        value={planMode}
        onValueChange={value => {
          if (value) setPlanMode(value as 'leg' | 'course');
        }}
        variant='primary'
      >
        <ToggleGroupItem value='leg' className='grow'>
          <Text>Leg</Text>
        </ToggleGroupItem>
        <ToggleGroupItem value='course' className='grow'>
          <Text>Course</Text>
        </ToggleGroupItem>
      </ToggleGroup>
      {planMode === 'leg' && <PlanLeg />}
      {planMode === 'course' && <PlanCourse />}
    </View>
  );
}
