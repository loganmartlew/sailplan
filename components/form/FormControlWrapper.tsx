import { View } from 'react-native';
import { Label, Text } from '../ui';
import { PropsWithChildren } from 'react';
import { FieldError } from 'react-hook-form';

interface FormControlWrapperProps extends PropsWithChildren {
  label?: string;
  name: string;
  error?: FieldError;
  required?: boolean;
}

export function FormControlWrapper({
  children,
  label,
  name,
  error,
  required,
}: FormControlWrapperProps) {
  return (
    <View className='flex flex-col gap-1'>
      {label && (
        <Label nativeID={name}>
          {label} {required && <Text>*</Text>}
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
