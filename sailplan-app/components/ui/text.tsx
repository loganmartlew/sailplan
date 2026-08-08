import * as Slot from '@rn-primitives/slot';
import { SlottableTextProps, TextRef } from '@rn-primitives/types';
import * as React from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '~/lib/utils';

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  ref,
  ...props
}: SlottableTextProps & { ref?: React.Ref<TextRef> }) {
  const textClass = React.use(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component
      className={cn(
        'text-base text-foreground web:select-text',
        textClass,
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}
Text.displayName = 'Text';

export { Text, TextClassContext };
