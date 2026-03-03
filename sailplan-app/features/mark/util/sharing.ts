import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getMarks } from '../api/getMarks';
import { markInsertSchema } from '../model/mark';
import { importMarks } from '../api/createMark';
import { z } from 'zod';

export function isSharingAvailable() {
  return Sharing.isAvailableAsync();
}

export async function exportToJson() {
  const marks = await getMarks();
  const mappedMarks = marks.map(mark => ({
    name: mark.name,
    latitude: mark.latitude,
    longitude: mark.longitude,
  }));

  const json = JSON.stringify(mappedMarks, null, 2);

  try {
    const file = new File(Paths.cache, 'sailplan-marks.json');
    file.create({ overwrite: true });
    file.write(json);

    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Export Sailplan Marks',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  } catch (error) {
    console.error('Error exporting marks:', error);
    throw new Error('Failed to export marks');
  }
}

export async function importFromJson() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled) return;
  if (!asset) return;

  try {
    const file = new File(asset.uri);
    const json = file.text();

    const parseResult = z.array(markInsertSchema).safeParse(JSON.parse(json));

    if (!parseResult.success) {
      console.error('Invalid mark data:', parseResult.error);
      throw new Error('Invalid mark data format');
    }

    const marks = parseResult.data;

    await importMarks(marks);
  } catch (error) {
    console.error('Error importing marks:', error);
    throw new Error('Failed to import marks');
  }
}
