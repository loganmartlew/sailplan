import { View } from 'react-native';
import { Badge, Separator, Text } from '~/components/ui';
import { useSettings } from '~/features/settings';
import { formatAngle, formatSpeed } from '~/lib/format';
import { Check } from '~/lib/icons';
import { cn } from '~/lib/utils';
import type { RankedSailEvaluation } from '../model/sailEvaluation';
import type { InterpolatedLimits } from '../util/limitScoring';
import type { WindZone } from '../model/windZone';
import { ConfidenceTierBadge } from './ConfidenceTierBadge';

/** Unrankable sails carry a −∞ score — render a dash, not the raw float. */
const formatScore = (score: number): string =>
  Number.isFinite(score) ? score.toFixed(2) : '—';

const windZoneLabels: Record<WindZone, string> = {
  upwind: 'Upwind',
  reaching: 'Reaching',
  downwind: 'Downwind',
};

/** Render the interpolated usable-TWA window as a compact human range. */
function formatUsableWindow({ minTwa, maxTwa }: InterpolatedLimits): string {
  if (minTwa == null && maxTwa == null) return '—';
  if (minTwa != null && maxTwa != null) {
    return `${formatAngle(minTwa)} – ${formatAngle(maxTwa)}`;
  }
  if (minTwa != null) return `≥ ${formatAngle(minTwa)}`;
  return `≤ ${formatAngle(maxTwa as number)}`;
}

interface SailEvaluationCardProps {
  evaluation: RankedSailEvaluation;
  /** Whether this sail made the suggested cut. */
  suggested: boolean;
  /** Reveal the raw ranking/polar/limit breakdown beneath the summary. */
  showDetails?: boolean;
}

function GroupLabel({ children }: { children: string }) {
  return (
    <Text className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
      {children}
    </Text>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className='flex-row items-center justify-between gap-2'>
      <Text className='text-xs text-muted-foreground'>{label}</Text>
      <Text className='shrink text-right text-xs font-medium text-foreground'>
        {value}
      </Text>
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

  const pointsUsed = reasoning.pointsUsed;
  const limitBasis = evaluation.hasLimits
    ? 'User limits'
    : evaluation.limitScore != null
      ? 'Polar coverage'
      : 'None';

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
            <GroupLabel>Ranking</GroupLabel>
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
            {reasoning.guardPenaltyTotal > 0 && (
              <DetailRow
                label='Guard penalty'
                value={`−${formatScore(reasoning.guardPenaltyTotal)}`}
              />
            )}
          </View>

          <View className='gap-1.5'>
            <GroupLabel>Basis</GroupLabel>
            <DetailRow label='Wind zone' value={windZoneLabels[evaluation.windZone]} />
            <DetailRow
              label='Predicted from'
              value={
                pointsUsed.length > 0
                  ? `${pointsUsed.length} polar point${pointsUsed.length === 1 ? '' : 's'}`
                  : 'no polar data'
              }
            />
            <DetailRow label='Limit basis' value={limitBasis} />
            <DetailRow
              label='Usable TWA'
              value={formatUsableWindow(reasoning.usableTwa)}
            />
          </View>

          {pointsUsed.length > 0 && (
            <View className='gap-1.5'>
              <GroupLabel>Interpolation points</GroupLabel>
              {pointsUsed.map((point, index) => (
                <DetailRow
                  key={`${point.tws}-${point.twa}-${index}`}
                  label={`${formatSpeed(point.tws, speedUnit)} · ${formatAngle(point.twa)}`}
                  value={formatSpeed(point.speed, speedUnit)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
