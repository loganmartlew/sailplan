import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { ColorPickerButton } from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

interface ColorPickerInputProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  label?: string;
  name: Path<TFieldValues>;
  required?: boolean;
  containerClassName?: string;
}

export function ColorPickerInput<
  TFieldValues extends FieldValues = FieldValues,
>({
  label,
  name,
  required,
  containerClassName,
}: ColorPickerInputProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();

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
          className={containerClassName}
        >
          <ColorPickerButton value={value} onChange={onChange} />
        </FormControlWrapper>
      )}
    />
  );
}
