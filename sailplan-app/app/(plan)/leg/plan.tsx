import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Badge, Button, H2, Label, Text } from '~/components/ui';
import { Coordinate } from '~/features/coordinate';
import { Mark, useMark } from '~/features/mark';
import {
  deserializeLegPlanData,
  DirectionsCard,
  TrueWindInputCard,
} from '~/features/plan';
import { Map } from '~/lib/icons';

function markToCoords(mark: Mark): Coordinate {
  return {
    latitude: mark.latitude,
    longitude: mark.longitude,
  };
}

export default function LegPlanResults() {
  const { planData: data } = useLocalSearchParams<{ planData: string }>();
  const planData = deserializeLegPlanData(data);

  const { data: fromMark, error: fromMarkError } = useMark(planData.from.id);
  const { data: toMark, error: toMarkError } = useMark(planData.to.id);

  const fromCoords = fromMark ? markToCoords(fromMark) : null;
  const toCoords = toMark ? markToCoords(toMark) : null;

  const isLoading = (!fromMark && !fromMarkError) || (!toMark && !toMarkError);
  const isError = !!fromMarkError || !!toMarkError;

  if (isLoading) {
    return (
      <View className='p-10'>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    console.error(fromMarkError, toMarkError);
    return (
      <View>
        <Text>Error loading data</Text>
      </View>
    );
  }

  return (
    <View className='py-5 px-3 flex gap-5 h-full'>
      <H2>Leg Plan</H2>
      <View className='flex flex-row gap-2 items-center'>
        <Badge variant='secondary' className='flex-grow py-2 px-1'>
          <Text className='text-md'>{fromMark?.name}</Text>
        </Badge>
        <Label>to</Label>
        <Badge variant='secondary' className='flex-grow py-2 px-1'>
          <Text className='text-md'>{toMark?.name}</Text>
        </Badge>
      </View>
      <TrueWindInputCard twd />
      <DirectionsCard fromCoords={fromCoords} toCoords={toCoords} />
      <Link
        href={{
          pathname: '/leg/map',
          params: {
            fromMarkId: fromMark?.id.toString(),
            toMarkId: toMark?.id.toString(),
          },
        }}
        push
        asChild
      >
        <Button className='flex flex-row gap-2'>
          <Text>View on map</Text>
          <Map className='text-secondary-foreground' size={18} />
        </Button>
      </Link>
    </View>
  );
}
