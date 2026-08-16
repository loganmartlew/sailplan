import { View } from 'react-native';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Text,
} from '~/components/ui';
import { CourseMarkRoutePoint } from '~/features/course';
import { TackDirectionBadge } from './TackDirectionBadge';
import { Route } from '~/lib/icons';

interface CourseMarkListDialogProps {
  courseMarks: CourseMarkRoutePoint[];
}

export function CourseMarkListDialog({
  courseMarks,
}: CourseMarkListDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon'>
          <Route size={20} className='text-foreground' />
        </Button>
      </DialogTrigger>
      <DialogContent className='w-[500px] max-w-[100vw] min-h-[50vh]'>
        <DialogHeader>
          <DialogTitle>Course Marks</DialogTitle>
        </DialogHeader>
        <View className='flex gap-5'>
          {courseMarks.map((cm, index) => (
            <View
              key={cm.courseMarkId}
              className='flex flex-row items-center justify-between py-1'
            >
              <View className='flex flex-row items-center gap-2'>
                <Text className='text-muted-foreground w-5 text-right'>
                  {index + 1}.
                </Text>
                <Text className='text-base font-medium'>{cm.name}</Text>
              </View>
              {cm.direction &&
                (cm.direction === 'port' || cm.direction === 'starboard') && (
                  <TackDirectionBadge
                    tack={cm.direction}
                  />
                )}
            </View>
          ))}
        </View>
      </DialogContent>
    </Dialog>
  );
}
