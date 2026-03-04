import { Pressable, View } from 'react-native';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Muted,
  Text,
} from '~/components/ui';
import { ChevronRight } from '~/lib/icons';
import { formatAngle } from '~/lib/format';
import { useSailTwaLimits } from '../api/getSailTwaLimits';
import { TWS_VALUES } from '../model/sailTwaLimit';

interface TwaLimitsPreviewCardProps {
  sailId: number;
  onPress: () => void;
}

export function TwaLimitsPreviewCard({
  sailId,
  onPress,
}: TwaLimitsPreviewCardProps) {
  const { data: twaLimits } = useSailTwaLimits(sailId);

  const configuredCount =
    twaLimits?.filter(l => l.minTwa != null || l.maxTwa != null).length ?? 0;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardHeader className='flex-row items-center justify-between pb-2'>
          <View className='flex-row items-center gap-2'>
            <CardTitle showBullet={false} className='text-foreground'>
              TWA Limits
            </CardTitle>
            <Badge variant='transparent'>
              <Text className='text-xs'>
                {configuredCount}/{TWS_VALUES.length}
              </Text>
            </Badge>
          </View>
          <ChevronRight className='text-muted-foreground' size={18} />
        </CardHeader>
        <CardContent>
          {configuredCount > 0 ? (
            <View className='flex gap-1'>
              {TWS_VALUES.map(tws => {
                const limit = twaLimits?.find(l => l.tws === tws);
                const hasValue =
                  limit && (limit.minTwa != null || limit.maxTwa != null);
                if (!hasValue) return null;
                return (
                  <View key={tws} className='flex-row items-center gap-2'>
                    <Text className='text-sm w-12 text-muted-foreground'>
                      {tws} kt
                    </Text>
                    <Text className='text-sm'>
                      {limit.minTwa != null ? formatAngle(limit.minTwa) : '—'}
                      {' – '}
                      {limit.maxTwa != null ? formatAngle(limit.maxTwa) : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Muted>No TWA limits configured</Muted>
          )}
        </CardContent>
      </Card>
    </Pressable>
  );
}
