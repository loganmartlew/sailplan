import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui';
import { CoordinateForm } from './CoordinateForm';

interface CoordinateDialogProps {
  field: 'latitude' | 'longitude';
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onFormSubmit: (decimalDegrees: number) => void;
  decimalDegrees: string | undefined;
}

export function CoordinateDialog({
  field,
  open,
  onFormSubmit,
  onOpenChange,
  decimalDegrees,
}: CoordinateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <DialogHeader>
          <DialogTitle>
            Edit {field === 'latitude' ? 'Latitude' : 'Longitude'}
          </DialogTitle>
        </DialogHeader>
        <CoordinateForm
          decimalDegrees={decimalDegrees}
          onFormSubmit={onFormSubmit}
          onOpenChange={onOpenChange}
          field={field}
          isDialog
        />
      </DialogContent>
    </Dialog>
  );
}
