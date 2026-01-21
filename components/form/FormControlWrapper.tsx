import { View } from 'react-native';
import { Label, Text } from '../ui';
import { PropsWithChildren } from 'react';
import { FieldError } from 'react-hook-form';
import { cn } from '~/lib/utils';

interface FormControlWrapperProps extends PropsWithChildren {
  label?: string;
  name: string;
  error?: FieldError;
  required?: boolean;
  className?: string;
}

export function FormControlWrapper({
  children,
  label,
  name,
  error,
  required,
  className,
}: FormControlWrapperProps) {
  return (
    <View className={cn('flex flex-col gap-1', className)}>
      {label && (
        <Label nativeID={name}>
          {label} {required && <Text className='text-primary'>*</Text>}
        </Label>
      )}
      {children}
      {error && (
        <Label
          className='text-destructive font-light italic'
          nativeID={`${name}-error`}
        >
          {error.message}
        </Label>
      )}
    </View>
  );
}
