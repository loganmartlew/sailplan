import { Pressable, View } from 'react-native';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
} from '~/components/ui';
import type { Sail } from '~/features/sail';
import { ChevronRight } from '~/lib/icons';
import { useSailTwaLimits } from '../api/getSailTwaLimits';
import { TWS_VALUES } from '../model/sailTwaLimit';
import { UsableEnvelopeChart } from './UsableEnvelopeChart';

interface TwaLimitsPreviewCardProps {
  sail: Sail;
  onPress: () => void;
}

export function TwaLimitsPreviewCard({
  sail,
  onPress,
}: TwaLimitsPreviewCardProps) {
  const { data: twaLimits } = useSailTwaLimits(sail.id);

  const configuredCount =
    twaLimits?.filter(l => l.minTwa != null || l.maxTwa != null).length ?? 0;

  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardHeader className='flex-row items-center justify-between pb-2'>
          <View className='flex-row items-center gap-2'>
            <CardTitle showBullet={false} className='text-foreground'>
              Usable Range
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
          <UsableEnvelopeChart sail={sail} twaLimits={twaLimits ?? []} />
        </CardContent>
      </Card>
    </Pressable>
  );
}
