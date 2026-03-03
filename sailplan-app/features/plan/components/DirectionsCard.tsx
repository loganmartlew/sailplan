import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
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
import {
  createSailPolar,
  NewSailPolarDialog,
  SailPolarSubmitValues,
} from '~/features/sailPolar';
import { Plus } from '~/lib/icons';
import { usePlanState } from '../store/planStore';

interface DirectionsCardProps {
  fromCoords: Coordinate | null;
  toCoords: Coordinate | null;
}

export function DirectionsCard({ fromCoords, toCoords }: DirectionsCardProps) {
  const { currentState } = usePlanState();
  const twd = currentState?.twd ?? 0;
  const [polarDialogOpen, setPolarDialogOpen] = useState(false);

  const bearing =
    fromCoords && toCoords
      ? coordsToBearing({ from: fromCoords, to: toCoords })
      : null;
  const twa = bearing != null ? getTwa({ twd, bearing }) : null;

  async function handlePolarSubmit(data: SailPolarSubmitValues) {
    await createSailPolar(data);
  }

  if (bearing == null || twa == null) {
    return (
      <View>
        <Text>Error calculating bearing and twa</Text>
      </View>
    );
  }

  return (
    <Card>
      <CardHeader className='flex-row items-center justify-between'>
        <CardTitle>Directions</CardTitle>
        <Button
          variant='transparent'
          size='sm'
          className='flex-row gap-1'
          onPress={() => setPolarDialogOpen(true)}
        >
          <Plus className='text-accent-foreground' size={16} />
          <Text>Polar</Text>
        </Button>
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
      <NewSailPolarDialog
        open={polarDialogOpen}
        onOpenChange={setPolarDialogOpen}
        onFormSubmit={handlePolarSubmit}
        defaultTwa={twa.angle}
      />
    </Card>
  );
}
