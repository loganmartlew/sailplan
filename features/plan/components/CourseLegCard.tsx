import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Text,
} from '~/components/ui';
import { CourseMarkWithMark } from '~/features/course';
import { TWA } from '~/features/coordinate';
import {
  createSailPolar,
  NewSailPolarDialog,
  SailPolarSubmitValues,
} from '~/features/sailPolar';
import { formatAngle } from '~/lib/format';
import { Plus } from '~/lib/icons';
import { cn } from '~/lib/utils';
import { TackDirectionBadge } from './TackDirectionBadge';

interface CourseLegCardProps {
  from: CourseMarkWithMark;
  to: CourseMarkWithMark;
  bearing: number;
  twa: TWA;
}

function MarkTitle({ mark }: { mark: CourseMarkWithMark }) {
  return (
    <CardTitle
      className='flex-row items-center shrink text-foreground'
      showBullet={false}
    >
      {mark.mark.name}
      <Text
        className={cn({
          'text-green-400': mark.direction === 'starboard',
          'text-red-400': mark.direction === 'port',
        })}
      >
        {mark.direction === 'starboard'
          ? ' S'
          : mark.direction === 'port'
            ? ' P'
            : ''}
      </Text>
    </CardTitle>
  );
}

export function CourseLegCard({ from, to, bearing, twa }: CourseLegCardProps) {
  const [polarDialogOpen, setPolarDialogOpen] = useState(false);

  async function handlePolarSubmit(data: SailPolarSubmitValues) {
    await createSailPolar(data);
  }

  return (
    <Card className='gap-2'>
      <CardHeader className='pb-3 flex-row items-start justify-between'>
        <View className='flex-row gap-3 flex-1'>
          <View className='items-center py-0.5'>
            <View className='w-2.5 h-2.5 rounded-full bg-primary' />
            <View className='w-0.5 flex-1 bg-primary/30 my-1' />
            <View className='w-2.5 h-2.5 rounded-full bg-primary' />
          </View>
          <View className='flex-1 gap-2'>
            <MarkTitle mark={from} />
            <MarkTitle mark={to} />
          </View>
        </View>
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
      <CardContent className='flex flex-row gap-4'>
        <View className='flex flex-1 gap-2'>
          <Label className='grow text-base'>Bearing</Label>
          <Text className='grow text-5xl font-bold'>
            {formatAngle(bearing)}
          </Text>
        </View>
        <View className='flex flex-1 gap-2'>
          <Label className='grow text-base text-right'>TWA</Label>
          <View className='grow flex items-end gap-2'>
            <Text className='grow text-5xl font-bold text-primary'>
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
