import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { FormControlWrapper } from './FormControlWrapper';
import {
  ToggleGroupItem,
  ToggleGroup as BaseToggleGroup,
  ToggleGroupProps as BaseToggleGroupProps,
} from '../ui/toggle-group';
import { Text } from '../ui';
import { cn } from '~/lib/utils';

type ToggleGroupProps<TFieldValues extends FieldValues = FieldValues> = Omit<
  BaseToggleGroupProps,
  'type' | 'value' | 'onValueChange'
> & {
  label?: string;
  name: Path<TFieldValues>;
  options: { label: string; value: string }[];
  growChildren?: boolean;
};

export function ToggleGroup<TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  options,
  growChildren,
  ...props
}: ToggleGroupProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => (
        <FormControlWrapper label={label} name={name} error={error}>
          <BaseToggleGroup
            {...props}
            type='single'
            value={value}
            onValueChange={value => onChange(value)}
          >
            {options.map(option => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className={cn(growChildren && 'grow')}
              >
                <Text>{option.label}</Text>
              </ToggleGroupItem>
            ))}
          </BaseToggleGroup>
        </FormControlWrapper>
      )}
    />
  );
}
