import { FC, PropsWithChildren, useMemo } from 'react';
import {
  FieldValues,
  FormProvider,
  UseFormProps,
  UseFormReturn,
  useForm as useHookForm,
} from 'react-hook-form';
import { View, ViewProps } from 'react-native';

type FormProps = PropsWithChildren<ViewProps>;

export function useForm<TFieldValues extends FieldValues = FieldValues>(
  props: UseFormProps<TFieldValues>
): [FC<FormProps>, UseFormReturn<TFieldValues>] {
  const form = useHookForm<TFieldValues>(props);

  const Form: FC<FormProps> = useMemo(
    () => (props: FormProps) =>
      (
        <FormProvider {...form}>
          <View {...props} />
        </FormProvider>
      ),
    []
  );

  return [Form, form];
}
