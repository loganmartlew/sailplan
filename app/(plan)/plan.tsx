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
  Text,
} from '~/components/ui';
import { Coordinate, coordsToBearing, getTwa } from '~/features/coordinate';
import { Mark, useMark } from '~/features/mark';
import { deserializePlanData } from '~/features/plan';
import { formatAngle, formatSpeed } from '~/lib/format';
import { MapPin } from '~/lib/icons/MapPin';

function markToCoords(mark: Mark): Coordinate {
  return {
    latitude: mark.latitude,
    longitude: mark.longitude,
  };
}

export default function PlanResults() {
  const { planData: data } = useLocalSearchParams<{ planData: string }>();
  const planData = deserializePlanData(data);

  const { data: fromMark, error: fromMarkError } = useMark(planData.from.id);
  const { data: toMark, error: toMarkError } = useMark(planData.to.id);

  const fromCoords = fromMark ? markToCoords(fromMark) : null;
  const toCoords = toMark ? markToCoords(toMark) : null;

  const bearing =
    fromCoords && toCoords ? coordsToBearing(fromCoords, toCoords) : null;
  const twa = bearing ? getTwa(bearing, planData.twd) : null;

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

  if (!bearing || !twa) {
    return (
      <View>
        <Text>Error calculating bearing and twa</Text>
      </View>
    );
  }

  return (
    <View className='p-7 flex gap-5 h-full'>
      <H2>Plan Results</H2>
      <View className='flex flex-row gap-2 items-center'>
        <Badge variant='secondary' className='flex-grow'>
          <Text className='text-md'>{fromMark?.name}</Text>
        </Badge>
        <Text className='text-sm'>to</Text>
        <Badge variant='secondary' className='flex-grow'>
          <Text className='text-md'>{toMark?.name}</Text>
        </Badge>
      </View>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle>True Wind</CardTitle>
        </CardHeader>
        <CardContent>
          <View className='flex flex-row gap-2'>
            <Text className='text-lg w-[50%]'>TWS:</Text>
            <Text className='text-lg w-[50%]'>
              {planData.tws ? formatSpeed(planData.tws) : '-'}
            </Text>
          </View>
          <View className='flex flex-row gap-2'>
            <Text className='text-lg w-[50%]'>TWD:</Text>
            <Text className='text-lg w-[50%]'>{formatAngle(planData.twd)}</Text>
          </View>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle>Directions</CardTitle>
        </CardHeader>
        <CardContent>
          <View className='flex flex-row gap-2'>
            <Text className='text-lg w-[50%]'>Bearing:</Text>
            <Text className='text-lg w-[50%]'>{formatAngle(bearing)}</Text>
          </View>
          <View className='flex flex-row gap-2'>
            <Text className='text-lg w-[50%]'>TWA:</Text>
            <Text className='text-lg w-[50%]'>
              {formatAngle(twa.angle)}
              {twa.tack ? ` (${twa.tack})` : ''}
            </Text>
          </View>
        </CardContent>
      </Card>
      <Link
        href={{
          pathname: '/marks/map',
          params: {
            fromMarkId: fromMark?.id.toString(),
            toMarkId: toMark?.id.toString(),
          },
        }}
        push
        asChild
      >
        <Button size='lg' variant='secondary' className='flex flex-row gap-2'>
          <Text>View on map</Text>
          <MapPin className='text-secondary-foreground' size={18} />
        </Button>
      </Link>
    </View>
  );
}
