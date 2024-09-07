import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { Input, InputProps } from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

interface NumberInputProps<TFieldValues extends FieldValues = FieldValues>
  extends InputProps {
  label?: string;
  name: Path<TFieldValues>;
  required?: boolean;
}

export function NumberInput<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  required,
  ...props
}: NumberInputProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => (
        <FormControlWrapper
          label={label}
          name={name}
          error={error}
          required={required}
        >
          <Input
            onChangeText={value => onChange(value)}
            onBlur={onBlur}
            value={`${value}`}
            error={!!error}
            keyboardType='numeric'
            {...props}
          />
        </FormControlWrapper>
      )}
    />
  );
}
