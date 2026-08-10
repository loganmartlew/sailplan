import { View } from 'react-native';
import { Button, H3, Muted, Text } from '~/components/ui';
import { useConfirm } from '~/hooks/useConfirm';
import { Trash } from '~/lib/icons';
import {
  deletePolarImportBatch,
  usePolarImportBatches,
} from '../api/polarImportBatch';

interface PolarImportBatchesProps {
  boatProfileId: number;
}

/** Lists the reversible provenance units created by CSV imports. */
export function PolarImportBatches({
  boatProfileId,
}: PolarImportBatchesProps) {
  const confirm = useConfirm();
  const { data: batches } = usePolarImportBatches(boatProfileId);

  if (!batches || batches.length === 0) return null;

  async function onDelete(batchId: number, fileName: string, rowCount: number) {
    const proceed = await confirm({
      title: 'Remove Import Batch',
      message: `Remove ${rowCount} imported ${rowCount === 1 ? 'polar' : 'polars'} from ${fileName}? Manual and captured polars will be kept.`,
      confirmText: 'Remove Import',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;
    await deletePolarImportBatch(batchId);
  }

  return (
    <View className='mt-6 gap-3 pb-6'>
      <H3>Import Batches</H3>
      {batches.map(batch => (
        <View
          key={batch.id}
          className='flex-row items-center justify-between rounded-md border border-border p-3'
        >
          <View className='flex-1 gap-1 pr-2'>
            <Text numberOfLines={1}>{batch.fileName}</Text>
            <Muted className='text-xs'>
              {batch.rowCount} {batch.rowCount === 1 ? 'polar' : 'polars'} ·{' '}
              {new Date(batch.importedAt).toLocaleDateString()}
            </Muted>
          </View>
          <Button
            variant='ghost'
            size='icon'
            onPress={() =>
              onDelete(batch.id, batch.fileName, batch.rowCount)
            }
          >
            <Trash className='text-destructive' size={18} />
          </Button>
        </View>
      ))}
    </View>
  );
}
