import { Pressable, View } from 'react-native';
import { Badge, Card, CardContent, Muted, Text } from '~/components/ui';
import type { Sail } from '~/features/sail';
import { ChevronRight } from '~/lib/icons';
import { cn } from '~/lib/utils';
import type { SailedLegSummary } from '../util/legReview';
import { formatCaptureDuration } from '../util/formatCaptureDuration';

const countFormat = new Intl.NumberFormat('en-NZ');

interface SailedLegListProps {
  legs: readonly SailedLegSummary[];
  sails: readonly Pick<Sail, 'id' | 'name' | 'color'>[];
  onOpen: (leg: SailedLegSummary) => void;
}

/**
 * What is in this session, without paging through it.
 *
 * Rows report **what a leg yields** — its sails, the polar bins its attributed
 * blocks would produce, whether the sailor has edited it — rather than whether
 * it has been ticked. There is no per-leg act left to tick: leaving a leg saves
 * it, and standing behind the data is one session-level decision at promotion.
 */
export function SailedLegList({ legs, sails, onOpen }: SailedLegListProps) {
  return (
    <View className='gap-3'>
      {legs.map(leg => (
        <Pressable
          key={leg.ordinal}
          accessibilityRole='button'
          accessibilityLabel={
            `Review ${leg.name}, ${formatCaptureDuration(leg.durationMs)}`
            + `, ${leg.reviewed ? 'edited' : 'not edited yet'}`
          }
          onPress={() => onOpen(leg)}
        >
          <Card>
            <CardContent className='flex-row items-center gap-3 py-4'>
              <View className='flex-1 gap-1.5'>
                <View className='flex-row items-center gap-2'>
                  <Text
                    numberOfLines={1}
                    className={cn(
                      'flex-1 text-base font-medium',
                      // Striking a leg out is a leg-level judgement, so it
                      // shows on the leg's own name and nowhere else.
                      !leg.used && 'line-through opacity-60',
                    )}
                  >
                    {leg.name}
                  </Text>
                  {leg.reviewed && (
                    <Badge variant='secondary'>
                      <Text>Edited</Text>
                    </Badge>
                  )}
                </View>
                <Muted className='text-xs'>
                  {new Date(leg.startTime).toLocaleTimeString('en-NZ', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {formatCaptureDuration(leg.durationMs)}
                  {' · '}
                  {countFormat.format(leg.sampleCount)} samples
                </Muted>
                <View className='flex-row flex-wrap items-center gap-1.5'>
                  {leg.sailIds.length === 0 ? (
                    <Badge variant='outline'>
                      <Text>No sail assigned</Text>
                    </Badge>
                  ) : (
                    leg.sailIds.map(sailId => {
                      const sail = sails.find(item => item.id === sailId);
                      return (
                        <View
                          key={sailId}
                          className='flex-row items-center gap-1 rounded-full border border-border px-2 py-0.5'
                        >
                          <View
                            className='h-2 w-2 rounded-full'
                            style={{ backgroundColor: sail?.color || undefined }}
                          />
                          <Text className='text-xs'>{sail?.name ?? 'Unknown sail'}</Text>
                        </View>
                      );
                    })
                  )}
                  <Badge variant={leg.attributedBins > 0 ? 'secondary' : 'outline'}>
                    <Text>
                      {leg.attributedBins}/{leg.steadyBins} bins
                    </Text>
                  </Badge>
                </View>
              </View>
              <ChevronRight className='text-muted-foreground' size={18} />
            </CardContent>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
