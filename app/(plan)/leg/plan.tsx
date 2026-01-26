import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  H2,
  Label,
  Separator,
  Text,
} from '~/components/ui';
import { Coordinate, coordsToBearing, getTwa } from '~/features/coordinate';
import { Mark, useMark } from '~/features/mark';
import { deserializeLegPlanData, TackDirectionBadge } from '~/features/plan';
import { DirectionsCard } from '~/features/plan/components/DirectionsCard';
import { formatAngle } from '~/lib/format';
import { MapPin } from '~/lib/icons';

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
    <View className='py-7 px-3 flex gap-5 h-full'>
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
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle>True Wind</CardTitle>
        </CardHeader>
        <CardContent>
          {/* <View className='flex flex-row gap-2'>
            <Text className='text-lg w-[50%]'>TWS:</Text>
            <Text className='text-lg w-[50%]'>
              {planData.tws ? formatSpeed(planData.tws) : '-'}
            </Text>
          </View> */}
          <View className='flex flex-row gap-2'>
            <Text className='text-lg w-[50%]'>TWD:</Text>
            <Text className='text-lg w-[50%]'>{formatAngle(planData.twd)}</Text>
          </View>
        </CardContent>
      </Card>
      <DirectionsCard
        fromCoords={fromCoords}
        toCoords={toCoords}
        twd={planData.twd}
      />
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
          <MapPin className='text-secondary-foreground' size={18} />
        </Button>
      </Link>
    </View>
  );
}
