import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { FormControlWrapper } from './FormControlWrapper';
import { Option, Select } from '../ui';

interface SelectInputProps<TFieldValues extends FieldValues = FieldValues> {
  options: Option[];
  label?: string;
  name: Path<TFieldValues>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SelectInput<TFieldValues extends FieldValues = FieldValues>({
  name,
  placeholder,
  label,
  required,
  options,
  ...props
}: SelectInputProps<TFieldValues>) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <FormControlWrapper
          label={label}
          name={name}
          error={error}
          required={required}
        >
          <Select
            value={value?.value}
            onValueChange={value =>
              onChange(options.find(opt => opt.value === value))
            }
            options={options}
            placeholder={{
              label: placeholder ?? 'Choose an option',
              value: null,
            }}
            disabled={props.disabled}
            error={!!error}
            {...props}
          />
        </FormControlWrapper>
      )}
    />
  );
}
