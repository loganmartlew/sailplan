import { Badge, Text } from '~/components/ui';
import { cn } from '~/lib/utils';
import type { ConfidenceTier } from '../model/confidenceTier';

const tierStyles: Record<
  ConfidenceTier,
  { badge: string; text: string; label: string }
> = {
  high: {
    badge: 'border-green-500/50 bg-green-500/10',
    text: 'text-green-500',
    label: 'High',
  },
  moderate: {
    badge: 'border-amber-500/50 bg-amber-500/10',
    text: 'text-amber-500',
    label: 'Moderate',
  },
  low: {
    badge: 'border-red-500/50 bg-red-500/10',
    text: 'text-red-400',
    label: 'Low',
  },
};

interface ConfidenceTierBadgeProps {
  tier: ConfidenceTier;
  /** Raw 0–1 confidence; shown alongside the tier label when provided. */
  confidence?: number;
}

export function ConfidenceTierBadge({
  tier,
  confidence,
}: ConfidenceTierBadgeProps) {
  const styles = tierStyles[tier];

  return (
    <Badge variant='outline' className={styles.badge}>
      <Text className={cn('text-xs font-semibold', styles.text)}>
        {styles.label}
        {confidence != null && ` · ${confidence.toFixed(2)}`}
      </Text>
    </Badge>
  );
}
