import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '../ui';
import { NumberInput, NumberInputProps } from './NumberInput';
import { Pencil } from '~/lib/icons/Pencil';
import { z } from 'zod';
import { useForm } from '~/hooks/useForm';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ToggleGroup } from './ToggleGroup';

function dmsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  cardinality: -1 | 1
) {
  const decimalDegrees =
    (degrees + minutes / 60 + seconds / 3600) * cardinality;
  return parseFloat(decimalDegrees.toFixed(8));
}

function decimalToDMS(decimalDegrees: number): {
  degrees: number;
  minutes: number;
  seconds: number;
  cardinality: -1 | 1;
} {
  const cardinality = decimalDegrees < 0 ? -1 : 1;
  const degrees = Math.floor(decimalDegrees);
  const minutes = Math.floor((decimalDegrees - degrees) * 60);
  const seconds = parseFloat(
    ((decimalDegrees - degrees - minutes / 60) * 3600).toFixed(8)
  );
  return { degrees, minutes, seconds, cardinality };
}

function dmmToDecimal(degrees: number, minutes: number, cardinality: -1 | 1) {
  const decimalDegrees = (degrees + minutes / 60) * cardinality;
  return parseFloat(decimalDegrees.toFixed(8));
}

function decimalToDMM(decimalDegrees: number): {
  degrees: number;
  minutes: number;
  cardinality: -1 | 1;
} {
  const cardinality = decimalDegrees < 0 ? -1 : 1;
  const degrees = Math.floor(decimalDegrees);
  const minutes = parseFloat((decimalDegrees - degrees).toFixed(8)) * 60;
  return { degrees, minutes, cardinality };
}

interface CoordinateInputProps extends NumberInputProps {
  field: 'latitude' | 'longitude';
}

export function CoordinateInput({ field, ...props }: CoordinateInputProps) {
  const [open, setOpen] = useState(false);
  const { setValue, watch } = useFormContext();

  const onFormSubmit = (decimalDegrees: number) => {
    setValue(field, decimalDegrees);
  };

  const value = watch(props.name) ?? '0';

  return (
    <>
      <NumberInput
        {...props}
        endAdornment={
          <Button size='icon' variant='secondary' onPress={() => setOpen(true)}>
            <Pencil className='text-muted-foreground' size={18} />
          </Button>
        }
      />
      {open && (
        <CoordinateDialog
          field={field}
          open={open}
          onOpenChange={setOpen}
          onFormSubmit={onFormSubmit}
          decimalDegrees={`${value}`}
        />
      )}
    </>
  );
}

const CoordFormat = z.enum(['DMS', 'DMM']); // Degrees Minutes Seconds, Degrees Decimal Minutes
const CompassDirection = z.enum(['N', 'S', 'E', 'W']);

type CompassDirection = z.infer<typeof CompassDirection>;

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

function compassToCardinality(compassDirection: CompassDirection) {
  return compassDirection === CompassDirection.enum.N ||
    compassDirection === CompassDirection.enum.E
    ? 1
    : -1;
}

function cardinalityToCompass(
  cardinality: -1 | 1,
  field: 'latitude' | 'longitude'
) {
  return cardinality === 1
    ? field === 'latitude'
      ? CompassDirection.enum.N
      : CompassDirection.enum.E
    : field === 'latitude'
    ? CompassDirection.enum.S
    : CompassDirection.enum.W;
}

interface CoordinateDialogProps {
  field: 'latitude' | 'longitude';
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onFormSubmit: (decimalDegrees: number) => void;
  decimalDegrees: string | undefined;
}

function CoordinateDialog({
  field,
  open,
  onFormSubmit,
  onOpenChange,
  decimalDegrees,
}: CoordinateDialogProps) {
  const { degrees, minutes, seconds } = decimalDegrees
    ? decimalToDMS(parseFloat(decimalDegrees))
    : { degrees: 0, minutes: 0, seconds: 0 };

  const [
    Form,
    {
      handleSubmit,
      reset,
      watch,
      getValues,
      formState: { isDirty },
    },
  ] = useForm<CoordinateFormValues>({
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

  // useEffect(() => {
  //   if (!isDirty) return;

  //   const { degrees, minutes, seconds, compassDirection, ...values } =
  //     getValues();

  //   const cardinality = compassToCardinality(compassDirection);

  //   if (coordFormat === CoordFormat.enum.DMS) {
  //     const decimal = dmmToDecimal(degrees, minutes, cardinality);
  //     const {
  //       degrees: newDegrees,
  //       minutes: newMinutes,
  //       seconds: newSeconds,
  //       cardinality: newCardinality,
  //     } = decimalToDMS(decimal);

  //     const newCompassDirection = cardinalityToCompass(newCardinality, field);

  //     reset({
  //       ...values,
  //       degrees: newDegrees,
  //       minutes: newMinutes,
  //       seconds: newSeconds,
  //       compassDirection: newCompassDirection,
  //     });
  //   } else {
  //     const decimal = dmsToDecimal(degrees, minutes, seconds ?? 0, cardinality);
  //     const {
  //       degrees: newDegrees,
  //       minutes: newMinutes,
  //       cardinality: newCardinality,
  //     } = decimalToDMM(decimal);

  //     const newCompassDirection = cardinalityToCompass(newCardinality, field);

  //     reset({
  //       ...values,
  //       degrees: newDegrees,
  //       minutes: newMinutes,
  //       compassDirection: newCompassDirection,
  //       seconds: 0,
  //     });
  //   }
  // }, [coordFormat, isDirty]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <Form className='flex flex-col gap-5'>
          <DialogHeader>
            <DialogTitle>
              Edit {field === 'latitude' ? 'Latitude' : 'Longitude'}
            </DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant='outline' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>Save Coordinate</Text>
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
