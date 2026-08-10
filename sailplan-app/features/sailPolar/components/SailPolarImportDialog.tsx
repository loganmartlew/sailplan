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
import { useBoatProfile } from '~/features/boatProfile';
import { useAlert } from '~/hooks/useAlert';
import { useConfirm } from '~/hooks/useConfirm';
import { Upload } from '~/lib/icons/Upload';
import { createPolarImportBatch } from '../api/polarImportBatch';
import { preparePolarCsvImport } from '../api/preparePolarCsvImport';

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
  const { boatProfile } = useBoatProfile();
  const alert = useAlert();
  const confirm = useConfirm();
  const [isImporting, setIsImporting] = useState(false);

  const onImport = async () => {
    setIsImporting(true);
    try {
      if (!boatProfile) return;

      const prepared = await preparePolarCsvImport(
        sails,
        boatProfile.id,
        limitedSails,
      );
      if (!prepared) return;

      if (prepared.kind === 'empty') {
        await alert({
          title: 'No Polars Imported',
          message: 'The file has no valid rows for the selected sail or sails.',
          confirmText: 'OK',
        });
        return;
      }

      if (prepared.kind === 'duplicate') {
        await alert({
          title: 'Already Imported',
          message:
            'These polar observations have already been imported. Remove the earlier import batch before importing a corrected export.',
          confirmText: 'OK',
        });
        return;
      }

      if (prepared.result.ignored > 0) {
        const proceed = await confirm({
          title: 'Some Polars Already Imported',
          message: `${prepared.result.inserted} new ${prepared.result.inserted === 1 ? 'row' : 'rows'} will be imported; ${prepared.result.ignored} previously imported ${prepared.result.ignored === 1 ? 'row' : 'rows'} will be ignored.`,
          cancelText: 'Cancel',
          confirmText: `Import ${prepared.result.inserted} ${prepared.result.inserted === 1 ? 'Row' : 'Rows'}`,
        });
        if (!proceed) return;
      }

      const { inserted } = await createPolarImportBatch(prepared.input);

      const result = { ...prepared.result, inserted };

      onOpenChange(false);

      const unmatchedNote =
        result.unmatched.length > 0
          ? `\n\nUnrecognised sail names: ${result.unmatched.join(', ')}`
          : '';

      const uncheckableNote =
        result.uncheckable > 0
          ? `\n\n${result.uncheckable} ${result.uncheckable === 1 ? 'row has' : 'rows have'} no valid timestamp and could not be checked for overlap.`
          : '';

      Alert.alert(
        'Import Complete',
        `${result.inserted} polar ${result.inserted === 1 ? 'row' : 'rows'} added.${unmatchedNote}${uncheckableNote}`,
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
