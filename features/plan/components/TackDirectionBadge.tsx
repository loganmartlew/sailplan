import { Badge, Text } from '~/components/ui';

export function TackDirectionBadge({ tack }: { tack: 'port' | 'starboard' }) {
  return (
    <Badge variant='transparent'>
      <Text className='uppercase mx-1'>{tack ?? ''}</Text>
    </Badge>
  );
}
