import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { Input, InputProps } from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

interface TextInputProps<
  TFieldValues extends FieldValues = FieldValues,
> extends InputProps {
  label?: string;
  name: Path<TFieldValues>;
  required?: boolean;
  containerClassName?: string;
  placeholder: string;
}

export function TextInput<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  required,
  containerClassName,
  ...props
}: TextInputProps<TFieldValues>) {
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
          className={containerClassName}
        >
          <Input
            onChangeText={value => onChange(value)}
            onBlur={onBlur}
            value={value}
            error={!!error}
            {...props}
          />
        </FormControlWrapper>
      )}
    />
  );
}
