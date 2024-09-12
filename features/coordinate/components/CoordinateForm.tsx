import { z } from 'zod';
import {
  compassToCardinality,
  decimalToDMS,
  dmmToDecimal,
  dmsToDecimal,
} from '../util/mappers';
import { useForm } from '~/hooks/useForm';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, DialogFooter, Text } from '~/components/ui';
import { NumberInput, ToggleGroup } from '~/components/form';
import { View } from 'react-native';
import { CompassDirection, CoordFormat } from '../util/types';

const coordinateFormSchema = z
  .object({
    degrees: z.number({ message: 'Degrees is required', coerce: true }),
    minutes: z.number({ message: 'Minutes is required', coerce: true }),
    seconds: z.number({ coerce: true }).optional(),
    coordFormat: CoordFormat,
    compassDirection: CompassDirection,
  })
  .refine(input => {
    if (
      input.coordFormat === CoordFormat.enum.DMS &&
      input.seconds !== undefined
    ) {
      return 'Seconds is required';
    }
    return true;
  });

type CoordinateFormValues = z.infer<typeof coordinateFormSchema>;

interface CoordinateFormProps {
  decimalDegrees: string | undefined;
  onFormSubmit: (decimalDegrees: number) => void;
  onOpenChange: (value: boolean) => void;
  field: 'latitude' | 'longitude';
  isDialog?: boolean;
}

export function CoordinateForm({
  decimalDegrees,
  onFormSubmit,
  onOpenChange,
  field,
  isDialog = false,
}: CoordinateFormProps) {
  const { degrees, minutes, seconds } = decimalDegrees
    ? decimalToDMS(parseFloat(decimalDegrees))
    : { degrees: 0, minutes: 0, seconds: 0 };

  const [Form, { handleSubmit, reset, watch }] = useForm<CoordinateFormValues>({
    resolver: zodResolver(coordinateFormSchema),
    defaultValues: {
      degrees,
      minutes,
      seconds,
      coordFormat: CoordFormat.enum.DMS,
      compassDirection:
        field === 'latitude'
          ? CompassDirection.enum.S
          : CompassDirection.enum.E,
    },
  });

  const coordFormat = watch('coordFormat');

  const onSubmit = (data: CoordinateFormValues) => {
    const { degrees, minutes, seconds, coordFormat, compassDirection } = data;

    const cardinality = compassToCardinality(compassDirection);

    const decimalDegrees =
      coordFormat === CoordFormat.enum.DMS
        ? dmsToDecimal(degrees, minutes, seconds ?? 0, cardinality)
        : dmmToDecimal(degrees, minutes, cardinality);

    onFormSubmit(decimalDegrees);
    onOpenChange(false);
    reset();
  };

  const onCancel = () => {
    onOpenChange(false);
    reset();
  };

  const directionOptions: {
    label: string;
    value: string;
  }[] =
    field === 'latitude'
      ? [
          { label: 'North', value: CompassDirection.enum.N },
          { label: 'South', value: CompassDirection.enum.S },
        ]
      : [
          { label: 'East', value: CompassDirection.enum.E },
          { label: 'West', value: CompassDirection.enum.W },
        ];

  const ButtonWrapper = isDialog ? DialogFooter : View;

  return (
    <Form className='flex flex-col gap-5'>
      <ToggleGroup
        name='coordFormat'
        label='Coordinate Format'
        options={[
          { value: 'DMS', label: 'Degrees Minutes Seconds' },
          { value: 'DMM', label: 'Degrees Decimal Minutes' },
        ]}
        growChildren
      />
      <ToggleGroup
        name='compassDirection'
        label='Compass Direction'
        options={directionOptions}
        growChildren
      />
      <NumberInput<CoordinateFormValues>
        label='Degrees'
        name='degrees'
        required
      />
      <NumberInput<CoordinateFormValues>
        label='Minutes'
        name='minutes'
        required
      />
      {coordFormat === CoordFormat.enum.DMS && (
        <NumberInput<CoordinateFormValues>
          label='Seconds'
          name='seconds'
          required
        />
      )}
      <ButtonWrapper>
        <Button variant='outline' onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        <Button onPress={handleSubmit(onSubmit)}>
          <Text>Save Coordinate</Text>
        </Button>
      </ButtonWrapper>
    </Form>
  );
}
