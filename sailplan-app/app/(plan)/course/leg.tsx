import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import {
  Card,
  CardContent,
  H2,
  H3,
  Label,
  Text,
} from '~/components/ui';
import { useBoatProfile } from '~/features/boatProfile';
import {
  deserializeCourseLegData,
  TackDirectionBadge,
  type CourseLegData,
} from '~/features/plan';
import {
  SuggestionBreakdown,
  useSailSuggestionData,
  useSailSuggestions,
} from '~/features/sailSuggestion';
import { formatAngle } from '~/lib/format';
import { cn } from '~/lib/utils';

function MarkLabel({ mark }: { mark: CourseLegData['from'] }) {
  return (
    <Text className='text-lg font-semibold text-foreground'>
      {mark.name}
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
    </Text>
  );
}

export default function CourseLegDetails() {
  const { legData: data } = useLocalSearchParams<{ legData: string }>();
  const legData = deserializeCourseLegData(data);

  const { boatProfile } = useBoatProfile();
  const suggestionData = useSailSuggestionData(boatProfile?.id ?? null);
  const sailSuggestions = useSailSuggestions(
    suggestionData,
    legData.twa.angle,
    legData.tws,
  );

  return (
    <ScrollView>
      <View className='py-5 px-3 flex gap-5'>
        <H2 className='pb-0'>Leg Details</H2>

        <View className='flex-row items-center gap-3'>
          <View className='items-center py-0.5'>
            <View className='w-2.5 h-2.5 rounded-full bg-primary' />
            <View className='w-0.5 h-6 bg-primary/30 my-1' />
            <View className='w-2.5 h-2.5 rounded-full bg-primary' />
          </View>
          <View className='flex-1 gap-3'>
            <MarkLabel mark={legData.from} />
            <MarkLabel mark={legData.to} />
          </View>
        </View>

        <Card>
          <CardContent className='pt-6 flex-row gap-4'>
            <View className='flex-1 gap-2'>
              <Label className='text-base'>TWA</Label>
              <View className='gap-2 items-start'>
                <Text className='text-5xl font-bold text-primary'>
                  {formatAngle(legData.twa.angle)}
                </Text>
                {legData.twa.tack && (
                  <TackDirectionBadge tack={legData.twa.tack} />
                )}
              </View>
            </View>
            <View className='gap-2'>
              <Label className='text-base text-right'>Bearing</Label>
              <Text className='text-3xl font-bold text-right'>
                {formatAngle(legData.bearing)}
              </Text>
            </View>
          </CardContent>
        </Card>

        <View className='gap-3'>
          <H3>Sail Suggestions</H3>
          {sailSuggestions ? (
            <SuggestionBreakdown result={sailSuggestions} />
          ) : (
            <Text className='text-sm text-muted-foreground'>
              No sail suggestions available for this leg.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
