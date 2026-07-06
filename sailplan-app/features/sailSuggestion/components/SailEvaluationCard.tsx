import { View } from 'react-native';
import { Badge, Separator, Text } from '~/components/ui';
import { useSettings } from '~/features/settings';
import { formatSpeed } from '~/lib/format';
import { Check } from '~/lib/icons';
import { cn } from '~/lib/utils';
import type { RankedSailEvaluation } from '../model/sailEvaluation';
import { ConfidenceTierBadge } from './ConfidenceTierBadge';

/** Unrankable sails carry a −∞ score — render a dash, not the raw float. */
const formatScore = (score: number): string =>
  Number.isFinite(score) ? score.toFixed(2) : '—';

interface SailEvaluationCardProps {
  evaluation: RankedSailEvaluation;
  /** Whether this sail made the suggested cut. */
  suggested: boolean;
  /** Reveal the raw ranking/polar/limit breakdown beneath the summary. */
  showDetails?: boolean;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className='flex-row items-center justify-between gap-2'>
      <Text className='text-xs text-muted-foreground'>{label}</Text>
      <Text className='text-xs font-medium text-foreground'>{value}</Text>
    </View>
  );
}

export function SailEvaluationCard({
  evaluation,
  suggested,
  showDetails = false,
}: SailEvaluationCardProps) {
  const { speedUnit } = useSettings();
  const { sail, reasoning } = evaluation;

  return (
    <View
      className={cn(
        'gap-3 rounded-2xl border p-4',
        suggested ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <View className='flex-row items-center gap-2'>
        <View
          className='w-4 h-4 rounded-full'
          style={{ backgroundColor: sail.color?.toLowerCase() || '#888888' }}
        />
        <Text
          className='shrink text-base font-semibold text-foreground'
          numberOfLines={1}
        >
          {sail.name}
        </Text>
        <View className='flex-1' />
        {suggested && (
          <Badge variant='secondary' className='flex-row items-center gap-1'>
            <Check size={12} className='text-secondary-foreground' />
            <Text className='text-xs font-semibold'>Suggested</Text>
          </Badge>
        )}
        <ConfidenceTierBadge
          tier={evaluation.confidenceTier}
          confidence={showDetails ? evaluation.confidence : undefined}
        />
      </View>

      <View className='flex-row items-baseline gap-2'>
        <Text className='text-sm text-muted-foreground'>Predicted speed</Text>
        {evaluation.predictedSpeed != null ? (
          <Text className='text-lg font-bold text-primary'>
            {formatSpeed(evaluation.predictedSpeed, speedUnit)}
          </Text>
        ) : (
          <Text className='text-sm italic text-muted-foreground'>
            no polar data
          </Text>
        )}
      </View>

      {evaluation.limitsExceeded && (
        <Text className='text-sm text-destructive'>
          {evaluation.hasLimits
            ? '⚠ Outside TWA limits'
            : '⚠ Outside observed range'}
        </Text>
      )}
      {evaluation.guards.map(guard => (
        <Text key={guard.guardName} className='text-sm text-amber-500'>
          ⚠ {guard.reason}
        </Text>
      ))}

      {showDetails && (
        <>
          <Separator />
          <View className='gap-1.5'>
            <DetailRow
              label='Ranking score'
              value={formatScore(evaluation.rankingScore)}
            />
            <DetailRow
              label='Polar score'
              value={
                evaluation.polarScore != null
                  ? `${formatScore(evaluation.polarScore)}  ·  weight ${formatScore(reasoning.polarWeight)}`
                  : '—'
              }
            />
            <DetailRow
              label='Limit score'
              value={
                evaluation.limitScore != null
                  ? `${formatScore(evaluation.limitScore)}  ·  weight ${formatScore(reasoning.limitWeight)}`
                  : '—'
              }
            />
            <DetailRow
              label='Confidence'
              value={formatScore(evaluation.confidence)}
            />
            {evaluation.guards.map(guard => (
              <DetailRow
                key={guard.guardName}
                label={`Penalty · ${guard.guardName}`}
                value={`−${formatScore(guard.penalty)}`}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
