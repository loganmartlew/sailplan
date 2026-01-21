import { useTheme } from '@react-navigation/native';
import { forwardRef } from 'react';
import PickerSelect, { PickerSelectProps } from 'react-native-picker-select';
import { NAV_THEME } from '~/lib/constants';
import { ChevronDown } from '~/lib/icons/ChevronDown';

export interface Option {
  label: string;
  value: string;
}

export type SelectProps = {
  options: Option[];
  value?: string | null;
  onValueChange: (value: string | null) => void;
  error?: boolean;
  disabled?: boolean;
} & Pick<PickerSelectProps, 'placeholder'>;

const Select = forwardRef<PickerSelect, SelectProps>(
  (
    {
      options,
      placeholder,
      value,
      onValueChange,
      error = false,
      disabled = false,
    },
    ref,
  ) => {
    const theme = useTheme();

    return (
      <PickerSelect
        value={value}
        onValueChange={onValueChange}
        items={options}
        placeholder={placeholder}
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
            borderRadius: 10,
            borderWidth: 1,
            borderColor: error ? 'red' : theme.colors.card,
            backgroundColor: theme.colors.card,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            color: theme.colors.text,
            opacity: disabled ? 0.5 : 1,
          },
          placeholder: {
            color: theme.colors.mutedForeground,
          },
          iconContainer: {
            top: 16,
            right: 10,
          },
        }}
        useNativeAndroidPickerStyle={false}
        disabled={disabled}
        ref={ref}
      />
    );
  },
);
Select.displayName = 'Select';

export { Select };
