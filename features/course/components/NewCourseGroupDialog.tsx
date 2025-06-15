import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextInput } from '~/components/form';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { useForm } from '~/hooks/useForm';

const courseGroupFormSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
});

export type CourseGroupFormValues = z.infer<typeof courseGroupFormSchema>;

interface NewCourseGroupDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onFormSubmit: (data: CourseGroupFormValues) => void;
}

export function NewCourseGroupDialog({
  open,
  onFormSubmit,
  onOpenChange,
}: NewCourseGroupDialogProps) {
  const [Form, { handleSubmit, reset }] = useForm<CourseGroupFormValues>({
    resolver: zodResolver(courseGroupFormSchema),
    defaultValues: {
      name: '',
    },
  });

  function onSubmit(data: CourseGroupFormValues) {
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
            <DialogTitle>New Course Group</DialogTitle>
          </DialogHeader>
          <TextInput<CourseGroupFormValues> label='Name' name='name' />
          <DialogFooter>
            <Button variant='outline' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>Create Course Group</Text>
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
