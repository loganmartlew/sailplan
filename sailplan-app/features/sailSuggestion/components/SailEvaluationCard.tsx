import Color from 'color';
import { View } from 'react-native';
import { Badge, Text } from '~/components/ui';
import { useSettings } from '~/features/settings';
import { formatSpeed } from '~/lib/format';
import { Check } from '~/lib/icons';
import type { RankedSailEvaluation } from '../model/sailEvaluation';
import { ConfidenceTierBadge } from './ConfidenceTierBadge';

/** Unrankable sails carry a −∞ score — render a dash, not the raw float. */
const formatScore = (score: number): string =>
  Number.isFinite(score) ? score.toFixed(2) : '—';

interface SailEvaluationCardProps {
  evaluation: RankedSailEvaluation;
  /** Whether this sail made the suggested cut. */
  suggested: boolean;
}

export function SailEvaluationCard({
  evaluation,
  suggested,
}: SailEvaluationCardProps) {
  const { speedUnit } = useSettings();
  const { sail, reasoning } = evaluation;

  const colorIsLight = new Color(
    sail.color?.toLowerCase() || '#888888',
  ).isLight();

  return (
    <View className='gap-1.5 rounded-lg border border-border p-3'>
      <View className='flex-row items-center gap-2'>
        <Badge
          variant='default'
          className='shrink'
          style={{ backgroundColor: sail.color }}
        >
          <Text
            className='text-sm'
            numberOfLines={1}
            style={{ color: colorIsLight ? '#000000' : '#FFFFFF' }}
          >
            {sail.name}
          </Text>
        </Badge>
        <View className='flex-1' />
        {suggested && (
          <Badge variant='secondary' className='flex-row items-center gap-1'>
            <Check size={12} className='text-secondary-foreground' />
            <Text className='text-xs font-semibold'>Suggested</Text>
          </Badge>
        )}
        <ConfidenceTierBadge
          tier={evaluation.confidenceTier}
          confidence={evaluation.confidence}
        />
      </View>

      <Text className='text-sm text-foreground'>
        score {formatScore(evaluation.rankingScore)}
        {evaluation.predictedSpeed != null &&
          ` · predicted ${formatSpeed(evaluation.predictedSpeed, speedUnit)}`}
      </Text>
      <Text className='text-sm text-muted-foreground'>
        polar{' '}
        {evaluation.polarScore != null
          ? `${formatScore(evaluation.polarScore)} (w ${formatScore(reasoning.polarWeight)})`
          : '—'}
        {'  ·  '}
        limit{' '}
        {evaluation.limitScore != null
          ? `${formatScore(evaluation.limitScore)} (w ${formatScore(reasoning.limitWeight)})`
          : '—'}
      </Text>

      {evaluation.limitsExceeded && (
        <Text className='text-sm text-destructive'>⚠ Outside TWA limits</Text>
      )}
      {evaluation.guards.map(guard => (
        <Text key={guard.guardName} className='text-sm text-amber-500'>
          ⚠ {guard.reason} (−{formatScore(guard.penalty)})
        </Text>
      ))}
    </View>
  );
}
