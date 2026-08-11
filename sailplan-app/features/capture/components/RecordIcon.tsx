import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { cn } from '~/lib/utils';

export function RecordIcon({
  className,
  ...props
}: ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        'h-6 w-6 items-center justify-center rounded-full bg-primary-foreground',
        className,
      )}
      {...props}
    >
      <View className='h-2 w-2 rounded-full bg-destructive' />
    </View>
  );
}
