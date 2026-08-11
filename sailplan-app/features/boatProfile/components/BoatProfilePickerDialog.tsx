import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui';
import { BoatProfilePicker } from './BoatProfilePicker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface BoatProfilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoatProfilePickerDialog({
  open,
  onOpenChange,
}: BoatProfilePickerDialogProps) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='w-[500px] max-w-[100vw]'>
          <DialogHeader>
            <DialogTitle>Select Boat Profile</DialogTitle>
          </DialogHeader>
          <GestureHandlerRootView style={{ flexShrink: 1 }}>
            <BoatProfilePicker
              onProfileChange={() => onOpenChange(false)}
              onProfileDetails={() => onOpenChange(false)}
            />
          </GestureHandlerRootView>
        </DialogContent>
      </Dialog>
    </>
  );
}
