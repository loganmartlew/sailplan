import * as React from 'react';
import { View } from 'react-native';
import { Button } from './button';
import { Input, InputProps } from './input';
import { Text } from './text';
import { useBufferedInput } from '~/hooks/useBufferedInput';

export interface StepperInputProps extends Omit<InputProps, 'value'> {
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: React.ReactNode;
  incrementLabel: React.ReactNode;
}

export function StepperInput({
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  onChangeText,
  onBlur,
  ...inputProps
}: StepperInputProps) {
  const buffered = useBufferedInput(value, text => onChangeText?.(text));

  return (
    <View className='flex flex-row gap-2'>
      <Button onPress={onDecrement} variant='transparent'>
        {typeof decrementLabel === 'string' ? (
          <Text>{decrementLabel}</Text>
        ) : (
          decrementLabel
        )}
      </Button>
      <View className='grow'>
        <Input
          value={buffered.value}
          onChangeText={buffered.onChangeText}
          onBlur={e => {
            buffered.commit();
            onBlur?.(e);
          }}
          {...inputProps}
        />
      </View>
      <Button onPress={onIncrement} variant='transparent'>
        {typeof incrementLabel === 'string' ? (
          <Text>{incrementLabel}</Text>
        ) : (
          incrementLabel
        )}
      </Button>
    </View>
  );
}
