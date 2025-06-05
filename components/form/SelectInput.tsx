import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import PickerSelect from 'react-native-picker-select';
import { FormControlWrapper } from './FormControlWrapper';
import { ChevronDown } from '~/lib/icons/ChevronDown';
import { useTheme } from '@react-navigation/native';

export interface Option {
  label: string;
  value: string;
}

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
  const theme = useTheme();

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
          <PickerSelect
            value={value?.value}
            onValueChange={value =>
              onChange(options.find(opt => opt.value === value))
            }
            items={options}
            placeholder={{
              label: placeholder ?? 'Choose an option',
              value: null,
            }}
            Icon={() => (
              <ChevronDown
                size={16}
                aria-hidden={true}
                className='text-foreground opacity-50'
              />
            )}
            style={{
              inputAndroid: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                height: 48,
                fontSize: 14,
                lineHeight: 20,
                justifyContent: 'space-between',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: error ? 'red' : theme.colors.border,
                backgroundColor: theme.colors.background,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                color: theme.colors.text,
                opacity: props.disabled ? 0.5 : 1,
              },
              iconContainer: {
                top: 16,
                right: 10,
              },
            }}
            useNativeAndroidPickerStyle={false}
          />
        </FormControlWrapper>
      )}
    />
  );
}
