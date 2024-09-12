import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectProps,
  SelectTrigger,
  SelectValue,
} from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

export interface Option {
  label: string;
  value: string;
}

interface SelectInputProps<TFieldValues extends FieldValues = FieldValues>
  extends SelectProps {
  options: Option[];
  label?: string;
  name: Path<TFieldValues>;
  placeholder?: string;
  required?: boolean;
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
          <Select
            value={value}
            onValueChange={value => onChange(value)}
            {...props}
          >
            <SelectTrigger onBlur={onBlur}>
              <SelectValue placeholder={placeholder ?? 'Choose an option'} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map(
                  option =>
                    option && (
                      <SelectItem
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControlWrapper>
      )}
    />
  );
}
