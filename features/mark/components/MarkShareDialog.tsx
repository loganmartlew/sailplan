import { Alert, View } from 'react-native';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import {
  exportToJson,
  importFromJson,
  isSharingAvailable,
} from '../util/sharing';
import { Upload } from '~/lib/icons/Upload';
import { Download } from '~/lib/icons/Download';
import { useEffect } from 'react';

interface MarkShareDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

export function MarkShareDialog({ open, onOpenChange }: MarkShareDialogProps) {
  const importMarks = async () => {
    await importFromJson();
    onOpenChange(false);
  };

  const exportMarks = async () => {
    await exportToJson();
    onOpenChange(false);
  };

  useEffect(() => {
    isSharingAvailable().then(available => {
      if (available) return;
      console.warn('Sharing is not available on this device');
      Alert.alert(
        'Sharing Not Available',
        'This device does not support sharing functionality.'
      );
      onOpenChange(false);
    });
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <DialogHeader>
          <DialogTitle>Share Marks</DialogTitle>
        </DialogHeader>
        <View className='flex flex-row gap-2'>
          <Button
            className='flex flex-1 flex-row gap-2'
            variant='default'
            onPress={importMarks}
          >
            <Upload className='text-primary-foreground' />
            <Text>Import</Text>
          </Button>
          <Button
            className='flex flex-1 flex-row gap-2'
            variant='secondary'
            onPress={exportMarks}
          >
            <Download className='text-secondary-foreground' />
            <Text>Export</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
