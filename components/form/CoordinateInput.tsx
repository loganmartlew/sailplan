import { Button } from '../ui';
import { NumberInput, NumberInputProps } from './NumberInput';
import { Pencil } from '~/lib/icons/Pencil';
import { useState, lazy, Suspense } from 'react';
import { useFormContext } from 'react-hook-form';

const CoordinateDialog = lazy(() =>
  import('~/features/coordinate').then(m => ({ default: m.CoordinateDialog }))
);

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
        <Suspense>
          <CoordinateDialog
            field={field}
            open={open}
            onOpenChange={setOpen}
            onFormSubmit={onFormSubmit}
            decimalDegrees={`${value}`}
          />
        </Suspense>
      )}
    </>
  );
}
