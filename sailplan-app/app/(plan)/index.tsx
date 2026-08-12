import { useState } from 'react';
import { ScrollView } from 'react-native';
import { H2, Text, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { useCaptureInset } from '~/features/capture';
import { PlanCourse, PlanLeg } from '~/features/plan';

export default function PlanPage() {
  const [planMode, setPlanMode] = useState<'leg' | 'course'>('leg');
  const captureInset = useCaptureInset();

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='w-full px-3 py-5 flex flex-col gap-6'
      contentContainerStyle={{ paddingBottom: 80 + captureInset }}
    >
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
    </ScrollView>
  );
}
