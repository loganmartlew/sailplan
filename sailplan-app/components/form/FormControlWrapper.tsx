import { View } from 'react-native';
import { Label, Text } from '../ui';
import { PropsWithChildren } from 'react';
import { FieldError } from 'react-hook-form';
import { cn } from '~/lib/utils';

export interface FormControlWrapperProps extends PropsWithChildren {
  label?: string;
  renderLabel?: (params: {
    label: string;
    name: string;
    defaultLabel: React.ReactNode;
    required?: boolean;
  }) => React.ReactNode;
  name: string;
  error?: FieldError;
  required?: boolean;
  className?: string;
}

export function FormControlWrapper({
  children,
  label,
  renderLabel,
  name,
  error,
  required,
  className,
}: FormControlWrapperProps) {
  const defaultLabel = (
    <Label nativeID={name} className='pl-1.5'>
      {label} {required && <Text className='text-primary'>*</Text>}
    </Label>
  );

  return (
    <View className={cn('flex flex-col gap-1', className)}>
      {label &&
        (renderLabel
          ? renderLabel({
              label,
              name,
              defaultLabel,
              required,
            })
          : defaultLabel)}
      {children}
      {error && (
        <Label
          className='text-destructive font-light italic normal-case'
          nativeID={`${name}-error`}
        >
          {error.message}
        </Label>
      )}
    </View>
  );
}
