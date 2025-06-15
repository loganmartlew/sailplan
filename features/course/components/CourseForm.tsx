import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { useForm } from '~/hooks/useForm';
import { useCourseGroups } from '../api/getCourses';
import { View } from 'react-native';
import { SelectInput, TextInput } from '~/components/form';
import { Button, Text } from '~/components/ui';

const courseFormSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
  courseGroup: z
    .object({
      value: z.string(),
      label: z.string(),
    })
    .optional(),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

const defaultValues: Partial<CourseFormValues> = {
  name: '',
  courseGroup: undefined,
};

interface CourseFormProps {
  onFormSubmit: (data: CourseFormValues) => void;
  onFormCancel: () => void;
  courseValues?: Partial<CourseFormValues>;
}

export function CourseForm({
  onFormSubmit,
  onFormCancel,
  courseValues,
}: CourseFormProps) {
  const courseGroupsQuery = useCourseGroups();

  const [Form, { handleSubmit, reset }] = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      ...defaultValues,
      ...courseValues,
    },
  });

  const onSubmit: SubmitHandler<CourseFormValues> = data => {
    onFormSubmit(data);
    reset(defaultValues);
  };

  const onCancel = () => {
    onFormCancel();
    reset(defaultValues);
  };

  const courseGroupOptions =
    courseGroupsQuery.data?.map(group => ({
      label: group.name,
      value: group.id.toString(),
    })) || [];

  return (
    <Form className='flex gap-5 grow'>
      <TextInput<CourseFormValues> name='name' label='Name' required />
      {courseGroupOptions.length > 0 && (
        <SelectInput<CourseFormValues>
          name='courseGroup'
          label='Course Group'
          options={courseGroupOptions}
          placeholder='Select a course group'
        />
      )}
      <View className='grow' />
      <Button onPress={handleSubmit(onSubmit)}>
        <Text>Save Course</Text>
      </Button>
      <Button variant='secondary' onPress={onCancel}>
        <Text>Cancel</Text>
      </Button>
    </Form>
  );
}
