import { ScrollView, useWindowDimensions, View } from 'react-native';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { useSettings } from '~/features/settings';
import { formatAngle, formatSpeed } from '~/lib/format';
import type { SailSuggestionResult } from '../model/sailSuggestion';
import type { WindZone } from '../model/windZone';
import { SailEvaluationCard } from './SailEvaluationCard';

const windZoneLabels: Record<WindZone, string> = {
  upwind: 'Upwind',
  reaching: 'Reaching',
  downwind: 'Downwind',
};

interface SuggestionBreakdownDialogProps {
  result: SailSuggestionResult;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

/**
 * Pure display of one leg's `SailSuggestionResult`: the conditions header,
 * then every evaluated sail in rank order. No data fetching — the course
 * screen already delivers the result to the leg card.
 */
export function SuggestionBreakdownDialog({
  result,
  open,
  onOpenChange,
}: SuggestionBreakdownDialogProps) {
  const { speedUnit } = useSettings();
  const { height } = useWindowDimensions();

  const suggestedIds = new Set(result.suggested.map(e => e.sail.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <DialogHeader>
          <DialogTitle>Sail Suggestions</DialogTitle>
          <DialogDescription>
            TWA {formatAngle(result.conditions.twa)} · TWS{' '}
            {formatSpeed(result.conditions.tws, speedUnit)} ·{' '}
            {windZoneLabels[result.conditions.windZone]}
          </DialogDescription>
        </DialogHeader>
        {result.isFallback && (
          <Text className='text-sm text-amber-500'>
            ⚠ Best available — all sails outside preferred range
          </Text>
        )}
        <ScrollView style={{ maxHeight: height * 0.55 }}>
          <View className='gap-2'>
            {result.evaluations.map(evaluation => (
              <SailEvaluationCard
                key={evaluation.sail.id}
                evaluation={evaluation}
                suggested={suggestedIds.has(evaluation.sail.id)}
              />
            ))}
          </View>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
