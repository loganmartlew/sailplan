import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { TWA } from '~/features/coordinate';
import {
  createSailPolar,
  NewSailPolarDialog,
  SailPolarSubmitValues,
} from '~/features/sailPolar';
import { formatAngle } from '~/lib/format';
import { Plus, Sailboat, MoveRight } from '~/lib/icons';
import { cn } from '~/lib/utils';
import { TackDirectionBadge } from './TackDirectionBadge';
import { serializeCourseLegData, type CourseLegData } from '../model/courseLegData';
import {
  useSailSuggestions,
  type RankedSailEvaluation,
  type SailSuggestionData,
} from '~/features/sailSuggestion';
import Color from 'color';
import { PlanRoutePoint } from '../util/planRoute';

function SailSuggestionBadges({
  suggested,
  isFallback,
}: {
  suggested: RankedSailEvaluation[];
  isFallback: boolean;
}) {
  // Only surface a sail name when we have a confident pick. A fallback
  // ("best available") or an empty result is not a real suggestion, so we
  // show a neutral placeholder — the leg is still drillable for the details.
  const hasGoodOption = suggested.length > 0 && !isFallback;

  if (!hasGoodOption) {
    return <Text className='text-sm text-muted-foreground'>No suggestion</Text>;
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
  from: PlanRoutePoint;
  to: PlanRoutePoint;
  bearing: number;
  twa: TWA;
  tws: number;
  suggestionData: SailSuggestionData | null;
}

function MarkTitle({ mark }: { mark: PlanRoutePoint }) {
  return (
    <CardTitle
      className='flex-row items-center shrink text-foreground'
      showBullet={false}
    >
      {mark.name}
      <Text
        className={cn({
          'text-green-400':
            mark.kind === 'courseMark' && mark.direction === 'starboard',
          'text-red-400': mark.kind === 'courseMark' && mark.direction === 'port',
        })}
      >
        {mark.kind === 'courseMark' && mark.direction === 'starboard'
          ? ' S'
          : mark.kind === 'courseMark' && mark.direction === 'port'
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
  suggestionData,
}: CourseLegCardProps) {
  const [polarDialogOpen, setPolarDialogOpen] = useState(false);

  const sailSuggestions = useSailSuggestions(suggestionData, twa.angle, tws);
  const suggested = sailSuggestions?.suggested ?? [];

  function openLegDetails() {
    const legData: CourseLegData = {
      from: {
        name: from.name,
        direction:
          from.kind === 'courseMark'
            ? from.direction
            : null,
      },
      to: {
        name: to.name,
        direction: to.kind === 'courseMark' ? to.direction : null,
      },
      bearing,
      twa,
      tws,
    };

    router.push({
      pathname: '/course/leg',
      params: { legData: serializeCourseLegData(legData) },
    });
  }

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
          <Pressable
            className='flex-row gap-1 items-center'
            onPress={openLegDetails}
          >
            <Sailboat size={16} className='text-muted-foreground mr-2' />
            <SailSuggestionBadges
              suggested={suggested}
              isFallback={sailSuggestions?.isFallback ?? false}
            />
          </Pressable>
          <Button variant='transparent' size='icon' onPress={openLegDetails}>
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
