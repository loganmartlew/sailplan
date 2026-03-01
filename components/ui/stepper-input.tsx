import * as React from 'react';
import { View } from 'react-native';
import { Button } from './button';
import { Input, InputProps } from './input';
import { Text } from './text';

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
  ...inputProps
}: StepperInputProps) {
  return (
    <View className='flex flex-row gap-2'>
      <Button onPress={onDecrement}>
        {typeof decrementLabel === 'string' ? (
          <Text>{decrementLabel}</Text>
        ) : (
          decrementLabel
        )}
      </Button>
      <View className='grow'>
        <Input value={value} {...inputProps} />
      </View>
      <Button onPress={onIncrement}>
        {typeof incrementLabel === 'string' ? (
          <Text>{incrementLabel}</Text>
        ) : (
          incrementLabel
        )}
      </Button>
    </View>
  );
}
