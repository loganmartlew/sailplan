import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormInput } from '~/components/form';
import { Button, Text } from '~/components/ui';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useForm } from '~/hooks/useForm';

const boatProfileFormSchema = z.object({
  name: z.string({ message: 'Name is required' }),
});

export type BoatProfileFormValues = z.infer<typeof boatProfileFormSchema>;

interface NewBoatProfileDialogProps {
  onFormSubmit: (data: BoatProfileFormValues) => void;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

export function NewBoatProfileDialog({
  open,
  onOpenChange,
  onFormSubmit,
}: NewBoatProfileDialogProps) {
  const [Form, { handleSubmit, reset }] = useForm<BoatProfileFormValues>({
    resolver: zodResolver(boatProfileFormSchema),
    defaultValues: {
      name: '',
    },
  });

  function onSubmit(data: BoatProfileFormValues) {
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
            <DialogTitle>New Boat Profile</DialogTitle>
            <DialogDescription>
              Enter details to create a new Boat Profile.
            </DialogDescription>
          </DialogHeader>
          <FormInput label='Name' name='name' />
          <DialogFooter>
            <Button variant='outline' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>Create Profile</Text>
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
