import { View } from 'react-native';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Separator,
  Text,
} from '~/components/ui';
import { TackDirectionBadge } from './TackDirectionBadge';
import { formatAngle } from '~/lib/format';
import { Coordinate, coordsToBearing, getTwa } from '~/features/coordinate';
import { usePlanState } from '../store/planStore';

interface DirectionsCardProps {
  fromCoords: Coordinate | null;
  toCoords: Coordinate | null;
}

export function DirectionsCard({ fromCoords, toCoords }: DirectionsCardProps) {
  const { currentState } = usePlanState();
  const twd = currentState?.twd ?? 0;

  const bearing =
    fromCoords && toCoords
      ? coordsToBearing({ from: fromCoords, to: toCoords })
      : null;
  const twa = bearing ? getTwa({ twd, bearing }) : null;

  if (!bearing || !twa) {
    return (
      <View>
        <Text>Error calculating bearing and twa</Text>
      </View>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Directions</CardTitle>
      </CardHeader>
      <CardContent className='flex gap-4'>
        <View className='flex flex-row gap-2'>
          <Label className='grow text-base'>Bearing:</Label>
          <Text className='grow text-right text-6xl font-bold'>
            {formatAngle(bearing)}
          </Text>
        </View>
        <Separator />
        <View className='flex flex-row gap-2'>
          <Label className='grow text-base'>TWA:</Label>
          <View className='grow flex items-end gap-2'>
            <Text className='grow text-right text-6xl font-bold text-primary'>
              {formatAngle(twa.angle)}
            </Text>
            {twa.tack && <TackDirectionBadge tack={twa.tack} />}
          </View>
        </View>
      </CardContent>
    </Card>
  );
}
