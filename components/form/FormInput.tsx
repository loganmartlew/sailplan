import {
  Control,
  Controller,
  FieldValues,
  Path,
  useFormContext,
} from 'react-hook-form';
import { Input, InputProps } from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

interface FormInputProps<TFieldValues extends FieldValues = FieldValues>
  extends InputProps {
  label?: string;
  name: Path<TFieldValues>;
}

export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  ...props
}: FormInputProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FormControlWrapper label={label} name={name} error={error}>
          <Input {...field} {...props} />
        </FormControlWrapper>
      )}
    />
  );
}
