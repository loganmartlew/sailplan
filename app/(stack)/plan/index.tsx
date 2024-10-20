import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '~/components/ui';
import { deserializePlanData } from '~/features/plan';

export default function PlanResults() {
  const { planData: data } = useLocalSearchParams<{ planData: string }>();
  const planData = deserializePlanData(data);

  console.log(JSON.stringify(planData, null, 2));

  return (
    <View>
      <Stack.Screen options={{ title: 'Plan Results' }} />
      <Text>Plan Results</Text>
      <Text>{JSON.stringify(planData, null, 2)}</Text>
    </View>
  );
}
