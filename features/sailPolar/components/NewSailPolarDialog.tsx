import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NumberInput } from '~/components/form';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { useForm } from '~/hooks/useForm';

const sailPolarFormSchema = z.object({
  tws: z
    .number({
      required_error: 'TWS is required',
      invalid_type_error: 'TWS must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'TWS must be greater than 0'),
  twa: z
    .number({
      required_error: 'TWA is required',
      invalid_type_error: 'TWA must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'TWA must be between 0 and 180')
    .max(180, 'TWA must be between 0 and 180'),
  speed: z
    .number({
      required_error: 'Boat speed is required',
      invalid_type_error: 'Boat speed must be a number',
      coerce: true,
    })
    .int()
    .min(0, 'Boat speed must be greater than 0'),
});

export type SailPolarFormValues = z.infer<typeof sailPolarFormSchema>;

interface NewSailPolarDialogProps {
  onFormSubmit: (data: SailPolarFormValues) => void;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

export function NewSailPolarDialog({
  open,
  onOpenChange,
  onFormSubmit,
}: NewSailPolarDialogProps) {
  const [Form, { handleSubmit, reset }] = useForm<SailPolarFormValues>({
    resolver: zodResolver(sailPolarFormSchema),
    defaultValues: {
      speed: 0,
      twa: 0,
      tws: 0,
    },
  });

  function onSubmit(data: SailPolarFormValues) {
    onFormSubmit(data);
    reset();
    onOpenChange(false);
  }

  function onCancel() {
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <Form className='flex flex-col gap-5'>
          <DialogHeader>
            <DialogTitle>New Sail Polar</DialogTitle>
            <DialogDescription>
              Enter details to create a new sail polar.
            </DialogDescription>
          </DialogHeader>
          <NumberInput<SailPolarFormValues> label='TWS' name='tws' />
          <NumberInput<SailPolarFormValues> label='TWA' name='twa' />
          <NumberInput<SailPolarFormValues> label='Boat Speed' name='speed' />
          <DialogFooter>
            <Button variant='outline' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>Create Polar</Text>
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
