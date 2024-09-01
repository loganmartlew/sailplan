import { View } from 'react-native';
import { Label } from '../ui';
import { PropsWithChildren } from 'react';
import { FieldError } from 'react-hook-form';

interface FormControlWrapperProps extends PropsWithChildren {
  label?: string;
  name: string;
  error?: FieldError;
}

export function FormControlWrapper({
  children,
  label,
  name,
  error,
}: FormControlWrapperProps) {
  return (
    <View className='flex flex-col gap-1'>
      {label && <Label nativeID={name}>{label}</Label>}
      {children}
      {error && (
        <Label className='text-error' nativeID={`${name}-error`}>
          {error.message}
        </Label>
      )}
    </View>
  );
}
