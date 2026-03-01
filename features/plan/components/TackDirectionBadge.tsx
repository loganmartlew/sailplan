import { Badge, Text } from '~/components/ui';
import { cn } from '~/lib/utils';

export function TackDirectionBadge({ tack }: { tack: 'port' | 'starboard' }) {
  return (
    <Badge
      variant='transparent'
      className={cn({
        'bg-green-200/30': tack === 'starboard',
        'bg-red-300/30': tack === 'port',
      })}
    >
      <Text
        className={cn('uppercase mx-1', {
          'text-green-400': tack === 'starboard',
          'text-red-400': tack === 'port',
        })}
      >
        {tack ?? ''}
      </Text>
    </Badge>
  );
}
