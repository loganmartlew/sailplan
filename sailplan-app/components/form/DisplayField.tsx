import { Input } from '../ui';
import { FormControlWrapper } from './FormControlWrapper';

interface DisplayFieldProps {
  label: string;
  name: string;
  value: string | number;
}

export function DisplayField({ label, value, name }: DisplayFieldProps) {
  return (
    <FormControlWrapper label={label} name={name}>
      <Input value={`${value}`} readOnly />
    </FormControlWrapper>
  );
}
