import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '~/components/ui';
import { useSettings } from '~/features/settings';
import { formatAngle, formatSpeed } from '~/lib/format';
import { ChevronDown, ChevronUp } from '~/lib/icons';
import type { SailSuggestionResult } from '../model/sailSuggestion';
import type { WindZone } from '../model/windZone';
import { SailEvaluationCard } from './SailEvaluationCard';

const windZoneLabels: Record<WindZone, string> = {
  upwind: 'Upwind',
  reaching: 'Reaching',
  downwind: 'Downwind',
};

interface SuggestionBreakdownProps {
  result: SailSuggestionResult;
}

/**
 * Pure display of one leg's `SailSuggestionResult`: a conditions summary line,
 * then every evaluated sail in rank order. Defaults to a clean, user-facing
 * view; a "Details" toggle reveals the raw ranking breakdown on every card.
 */
export function SuggestionBreakdown({ result }: SuggestionBreakdownProps) {
  const { speedUnit } = useSettings();
  const [showDetails, setShowDetails] = useState(false);

  const suggestedIds = new Set(result.suggested.map(e => e.sail.id));

  return (
    <View className='gap-3'>
      <View className='flex-row items-center justify-between gap-2'>
        <Text className='shrink text-sm text-muted-foreground'>
          TWA {formatAngle(result.conditions.twa)} · TWS{' '}
          {formatSpeed(result.conditions.tws, speedUnit)} ·{' '}
          {windZoneLabels[result.conditions.windZone]}
        </Text>
        <Button
          variant='ghost'
          size='sm'
          className='flex-row items-center gap-1'
          onPress={() => setShowDetails(value => !value)}
        >
          <Text className='text-xs text-muted-foreground'>Details</Text>
          {showDetails ? (
            <ChevronUp size={14} className='text-muted-foreground' />
          ) : (
            <ChevronDown size={14} className='text-muted-foreground' />
          )}
        </Button>
      </View>
      {result.isFallback && (
        <Text className='text-sm text-amber-500'>
          ⚠ Best available — all sails outside preferred range
        </Text>
      )}
      <View className='gap-2'>
        {result.evaluations.map(evaluation => (
          <SailEvaluationCard
            key={evaluation.sail.id}
            evaluation={evaluation}
            suggested={suggestedIds.has(evaluation.sail.id)}
            showDetails={showDetails}
          />
        ))}
      </View>
    </View>
  );
}
