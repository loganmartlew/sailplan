import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { StepperInput, StepperInputProps } from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

export interface StepperNumberInputProps<
  TFieldValues extends FieldValues = FieldValues,
> extends Omit<
  StepperInputProps,
  'value' | 'onChangeText' | 'onDecrement' | 'onIncrement'
> {
  name: Path<TFieldValues>;
  label?: string;
  required?: boolean;
  /** Given the current numeric value, return the new value after decrementing. */
  onDecrement: (current: number | null) => number | null;
  /** Given the current numeric value, return the new value after incrementing. */
  onIncrement: (current: number | null) => number | null;
  /** Parse a text input string into a number. Return null to clear the field. Defaults to parseInt. */
  parse?: (value: string) => number | null;
  /** Format the stored numeric value for display. Defaults to String(). */
  format?: (value: number) => string;
}

export function StepperNumberInput<
  TFieldValues extends FieldValues = FieldValues,
>({
  name,
  label,
  required,
  onDecrement,
  onIncrement,
  parse,
  format,
  ...inputProps
}: StepperNumberInputProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();

  const parseValue =
    parse ??
    ((v: string) => {
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    });

  const formatValue = format ?? ((v: number) => String(v));

  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => {
        return (
          <FormControlWrapper
            label={label}
            name={name}
            error={error}
            required={required}
          >
            <StepperInput
              keyboardType='numeric'
              {...inputProps}
              value={value != null ? formatValue(value) : ''}
              onChangeText={text => onChange(parseValue(text))}
              onBlur={onBlur}
              onDecrement={() => onChange(onDecrement(value))}
              onIncrement={() => onChange(onIncrement(value))}
              error={!!error}
            />
          </FormControlWrapper>
        );
      }}
    />
  );
}
