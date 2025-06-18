import { z } from 'zod';
import { courseMarkDirection } from '../model/courseMark';
import { useForm } from '~/hooks/useForm';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { useMarks } from '~/features/mark';
import { SelectInput, ToggleGroup } from '~/components/form';

const courseMarkFormSchema = z.object({
  mark: z.object(
    {
      value: z.string(),
      label: z.string(),
    },
    {
      required_error: 'Mark is required',
    }
  ),
  direction: z.enum(['none', 'port', 'starboard']),
});

export type CourseMarkFormValues = z.infer<typeof courseMarkFormSchema>;

const defaultValues: Partial<CourseMarkFormValues> = {
  direction: 'none',
};

interface NewCourseMarkDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onFormSubmit: (data: CourseMarkFormValues) => void;
  courseMarkValues?: Partial<CourseMarkFormValues>;
}

export function NewCourseMarkDialog({
  open,
  onOpenChange,
  onFormSubmit,
  courseMarkValues,
}: NewCourseMarkDialogProps) {
  const marksQuery = useMarks();

  const [Form, { handleSubmit, reset }] = useForm<CourseMarkFormValues>({
    resolver: zodResolver(courseMarkFormSchema),
    defaultValues: {
      ...defaultValues,
      ...courseMarkValues,
    },
  });

  const isEditing = !!courseMarkValues;

  function onSubmit(data: CourseMarkFormValues) {
    onFormSubmit(data);
    reset();
    onOpenChange(false);
  }

  function onCancel() {
    reset();
    onOpenChange(false);
  }

  const markOptions =
    marksQuery.data?.map(mark => ({
      label: mark.name,
      value: mark.id.toString(),
    })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <Form className='flex flex-col gap-5'>
          <DialogHeader>
            <DialogTitle>New Course Mark</DialogTitle>
          </DialogHeader>
          <SelectInput<CourseMarkFormValues>
            name='mark'
            label='Mark'
            options={markOptions}
            required
            disabled={isEditing}
          />
          <ToggleGroup<CourseMarkFormValues>
            name='direction'
            label='Direction'
            options={[
              { label: 'None', value: 'none' },
              { label: 'Port', value: 'port' },
              { label: 'Starboard', value: 'starboard' },
            ]}
            growChildren
          />
          <DialogFooter>
            <Button variant='outline' onPress={onCancel}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={handleSubmit(onSubmit)}>
              <Text>{isEditing ? 'Save' : 'Add'} Course Mark</Text>
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
