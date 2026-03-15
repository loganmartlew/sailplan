import { useState } from 'react';
import { View } from 'react-native';
import {
  Badge,
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
import type { SailEvaluation } from '~/features/sailSuggestion/model/sailEvaluation';
import { formatAngle } from '~/lib/format';
import { Plus, Sailboat, MoveRight } from '~/lib/icons';
import { cn } from '~/lib/utils';
import { TackDirectionBadge } from './TackDirectionBadge';
import { useSailSuggestions } from '~/features/sailSuggestion';
import Color from 'color';

function SailSuggestionBadges({ suggested }: { suggested: SailEvaluation[] }) {
  if (suggested.length === 0) {
    return (
      <Text className='text-sm text-muted-foreground'>No Suggestions</Text>
    );
  }

  const topSail = suggested[0];
  const colorIsLight = new Color(
    topSail.sail.color?.toLowerCase() || '#888888',
  ).isLight();

  return (
    <>
      <Badge variant='default' style={{ backgroundColor: topSail.sail.color }}>
        <Text
          className='text-sm'
          style={{ color: colorIsLight ? '#000000' : '#FFFFFF' }}
        >
          {topSail.sail.name}
        </Text>
      </Badge>
      {suggested.length > 1 && (
        <Text className='text-sm text-muted-foreground'>
          +{suggested.length - 1} more
        </Text>
      )}
    </>
  );
}

interface CourseLegCardProps {
  from: CourseMarkWithMark;
  to: CourseMarkWithMark;
  bearing: number;
  twa: TWA;
  tws: number;
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

export function CourseLegCard({
  from,
  to,
  bearing,
  twa,
  tws,
}: CourseLegCardProps) {
  const [polarDialogOpen, setPolarDialogOpen] = useState(false);

  const sailSuggestions = useSailSuggestions(twa.angle, tws);
  const suggested = sailSuggestions?.suggested ?? [];

  // if (from.mark.name === '') {
  console.log(
    JSON.stringify(
      {
        from: from.mark.name,
        to: to.mark.name,
        twa: twa.angle,
        suggested,
      },
      null,
      2,
    ),
  );
  // }

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

      <CardContent className='gap-4'>
        <View className='flex flex-row gap-4'>
          <View className='flex flex-1 gap-2'>
            <Label className='grow text-base'>TWA</Label>
            <View className='grow flex gap-2 items-start'>
              <Text className='grow text-5xl font-bold text-primary'>
                {formatAngle(twa.angle)}
              </Text>
              {twa.tack && <TackDirectionBadge tack={twa.tack} />}
            </View>
          </View>
          <View className='flex gap-2'>
            <Label className='grow text-base text-right'>Bearing</Label>
            <Text className='grow text-3xl font-bold text-right'>
              {formatAngle(bearing)}
            </Text>
          </View>
        </View>
        <View className='flex-row justify-between items-center'>
          <View className='flex-row gap-1 items-center'>
            <Sailboat size={16} className='text-muted-foreground mr-2' />
            <SailSuggestionBadges suggested={suggested} />
          </View>
          <Button variant='transparent' size='icon'>
            <MoveRight size={16} className='text-accent-foreground' />
          </Button>
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
