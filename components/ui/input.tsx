import * as React from 'react';
import { TextInput, View } from 'react-native';
import { cn } from '~/lib/utils';

export interface InputProps
  extends React.ComponentPropsWithoutRef<typeof TextInput> {
  error?: boolean;
  endAdornment?: React.ReactNode;
}

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, InputProps>(
  ({ className, placeholderClassName, error, endAdornment, ...props }, ref) => {
    return (
      <View
        className={cn(
          'web:flex h-10 native:h-12 web:w-full rounded-md border border-input bg-background px-3 web:py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground placeholder:text-muted-foreground web:ring-offset-background file:border-0 file:bg-transparent file:font-medium web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
          'flex flex-row gap-2 items-center',
          props.editable === false && 'opacity-50 web:cursor-not-allowed',
          error && 'border-destructive',
          className
        )}
      >
        <TextInput
          ref={ref}
          className='flex-1 w-full h-full bg-transparent grow text-foreground placeholder:text-muted-foreground'
          placeholderClassName={cn(
            'text-muted-foreground',
            placeholderClassName
          )}
          {...props}
        />
        {endAdornment}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input };
