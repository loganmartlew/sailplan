import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, CardContent, H3, Muted, Text } from '~/components/ui';
import { useSails } from '~/features/sail';
import { useConfirm } from '~/hooks/useConfirm';
import {
  promoteCaptureSession,
  useCapturePromotion,
} from '../api/capturePromotion';
import {
  promotionBandLabel,
  promotionDeltaLabel,
  promotionTableNote,
  promotionTwsLabel,
} from '../util/promotionLabels';
import type { PromotionComparisonRow } from '../util/promotionReview';

/** `1 point`, `4 points` — said four times on this screen. */
const points = (count: number) => `${count} ${count === 1 ? 'point' : 'points'}`;

function BandRow({ row }: { row: PromotionComparisonRow }) {
  const delta = promotionDeltaLabel(row);
  return (
    <View className='flex-row items-start justify-between gap-3 py-2'>
      <View className='flex-1 gap-0.5'>
        <Text className='font-medium'>{promotionBandLabel(row)}</Text>
        <Muted className='text-sm'>
          {promotionTwsLabel(row)} · {points(row.pointCount)}
        </Muted>
        <Muted className='text-sm'>{promotionTableNote(row)}</Muted>
      </View>
      <View className='items-end gap-1'>
        <Text className='text-base font-medium'>{row.capturedSpeed.toFixed(1)} kn</Text>
        {delta === null ? (
          <Badge variant='outline'>
            <Text>No comparison</Text>
          </Badge>
        ) : (
          <Badge variant={row.support === 'low' ? 'outline' : 'secondary'}>
            <Text>{delta} kn</Text>
          </Badge>
        )}
      </View>
    </View>
  );
}

interface CapturePromotionProps {
  sessionId: number;
}

/**
 * The last act: what this race would add to the polar, per sail and per 10° TWA
 * band, against what the table already says — shown in full **before** anything
 * is written. A scatter of dots gives nothing to argue with.
 */
export function CapturePromotion({ sessionId }: CapturePromotionProps) {
  const {
    points: proposed,
    comparison,
    reviewedLegCount,
    legCount,
    promotedPointCount,
    loading,
  } = useCapturePromotion(sessionId);
  const sailsQuery = useSails();
  const sails = sailsQuery?.data ?? [];
  const confirm = useConfirm();
  const [promoted, setPromoted] = useState<number | null>(null);

  if (loading) return null;

  const promote = async () => {
    if (
      promotedPointCount > 0
      && !(await confirm({
        title: 'Promote again?',
        message:
          `This session has already contributed ${points(promotedPointCount)} `
          + `to your polars. Promoting again replaces `
          + `${promotedPointCount === 1 ? 'it' : 'them'} with the ${proposed.length} `
          + 'shown here — it does not add to them.',
        confirmText: 'Replace',
        cancelText: 'Cancel',
      }))
    ) return;
    setPromoted((await promoteCaptureSession(sessionId, proposed)).length);
  };

  const sailName = (sailId: number) =>
    sails.find(item => item.id === sailId)?.name ?? `Sail ${sailId}`;
  const bySail = [...new Set(comparison.map(row => row.sailId))];

  return (
    <Card>
      <CardContent className='gap-4 py-5'>
        <View className='gap-1'>
          <H3>Promote to your polars</H3>
          <Muted>
            {reviewedLegCount} of {legCount} {legCount === 1 ? 'leg' : 'legs'} edited
            {promotedPointCount > 0
              ? ` · ${promotedPointCount} already promoted from this session`
              : ''}
          </Muted>
        </View>

        {promoted !== null ? (
          <View className='gap-2'>
            <Text>
              {promoted === 0
                ? 'This session now contributes nothing to your polars.'
                : `${points(promoted)} ${promoted === 1 ? 'is' : 'are'} now in your polars.`}
            </Text>
            <Button variant='outline' onPress={() => setPromoted(null)}>
              <Text>Show the comparison again</Text>
            </Button>
          </View>
        ) : comparison.length === 0 ? (
          <View className='gap-2'>
            <Text>
              {reviewedLegCount === 0
                ? 'Open the legs you want in your polars and attribute their sails first.'
                : 'No band reached the evidence it needs, so this session proposes nothing.'}
            </Text>
          </View>
        ) : (
          <View className='gap-4'>
            {bySail.map(sailId => (
              <View key={sailId} className='gap-1'>
                <Text className='font-medium'>{sailName(sailId)}</Text>
                {comparison
                  .filter(row => row.sailId === sailId)
                  .map(row => (
                    <BandRow key={row.bandStartTwa} row={row} />
                  ))}
              </View>
            ))}
            <Button onPress={promote}>
              <Text>Promote {points(proposed.length)}</Text>
            </Button>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
