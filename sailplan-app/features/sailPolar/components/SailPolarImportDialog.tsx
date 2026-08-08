import { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { Sail } from '~/features/sail';
import { Upload } from '~/lib/icons/Upload';
import { importPolarsFromCsv } from '../util/sharing';

interface SailPolarImportDialogProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sails: Sail[];
  limitedSails?: boolean;
}

export function SailPolarImportDialog({
  open,
  onOpenChange,
  sails,
  limitedSails = false,
}: SailPolarImportDialogProps) {
  const [isImporting, setIsImporting] = useState(false);

  const onImport = async () => {
    setIsImporting(true);
    try {
      const result = await importPolarsFromCsv(sails, limitedSails);
      if (!result) return;

      onOpenChange(false);

      const unmatchedNote =
        result.unmatched.length > 0
          ? `\n\nUnrecognised sail names: ${result.unmatched.join(', ')}`
          : '';

      Alert.alert(
        'Import Complete',
        `${result.inserted} polar ${result.inserted === 1 ? 'row' : 'rows'} added.${unmatchedNote}`,
      );
    } catch (error) {
      console.error('Import Failed:', error);
      Alert.alert(
        'Import Failed',
        'Could not read the CSV file. Please check the file format.',
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[500px] max-w-[100vw]'>
        <DialogHeader>
          <DialogTitle>Import Polars</DialogTitle>
        </DialogHeader>
        <View className='flex flex-row gap-2'>
          <Button
            className='flex flex-1 flex-row gap-2'
            onPress={onImport}
            disabled={isImporting}
          >
            <Upload className='text-primary-foreground' />
            <Text>{isImporting ? 'Importing…' : 'Import CSV'}</Text>
          </Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
