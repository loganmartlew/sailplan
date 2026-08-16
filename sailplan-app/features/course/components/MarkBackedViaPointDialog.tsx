import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Select, Text } from '~/components/ui';
import { useMarks } from '~/features/mark';
import { eligibleViaPointMarks } from '../util/eligibleViaPointMarks';
import { getRoutePointNoteCounter, normaliseRoutePointNote, ROUTE_POINT_NOTE_MAX_LENGTH } from '../util/routePointNote';

export interface MarkBackedViaPointValues { markId: number; note: string | null }
interface MarkBackedViaPointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bounds: { startMarkId: number; endMarkId: number };
  initial?: MarkBackedViaPointValues;
  onSave: (values: MarkBackedViaPointValues) => Promise<void>;
}

export function MarkBackedViaPointDialog({ open, onOpenChange, bounds, initial, onSave }: MarkBackedViaPointDialogProps) {
  const { data: marks = [] } = useMarks();
  const [markId, setMarkId] = useState<string | null>(initial?.markId.toString() ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  useEffect(() => { setMarkId(initial?.markId.toString() ?? null); setNote(initial?.note ?? ''); }, [initial, open]);
  const eligible = useMemo(() => eligibleViaPointMarks(marks, bounds), [marks, bounds]);
  const selected = marks.find(mark => mark.id.toString() === markId);
  const remaining = getRoutePointNoteCounter(note);

  async function save() {
    if (!markId || note.length > ROUTE_POINT_NOTE_MAX_LENGTH) return;
    await onSave({ markId: Number(markId), note: normaliseRoutePointNote(note) });
    onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className='w-[500px] max-w-[100vw]'>
      <DialogHeader><DialogTitle>{initial ? 'Edit' : 'Existing Mark'} Via Point</DialogTitle></DialogHeader>
      <View className='gap-4'>
        <View className='gap-1'><Text className='text-sm'>Saved Mark</Text><Select options={eligible.map(mark => ({ label: mark.name, value: mark.id.toString() }))} value={markId} onValueChange={setMarkId} placeholder={{ label: 'Choose a Mark', value: null }} /></View>
        {selected && <View className='rounded-xl bg-muted p-3'><Text className='font-semibold'>{selected.name}</Text><Text className='text-muted-foreground'>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</Text><Text className='text-xs text-muted-foreground'>Name and coordinates are owned by the saved Mark.</Text></View>}
        <View className='gap-1'><Text className='text-sm'>Course note</Text><Input value={note} onChangeText={setNote} maxLength={ROUTE_POINT_NOTE_MAX_LENGTH + 1} placeholder='Optional note' error={note.length > ROUTE_POINT_NOTE_MAX_LENGTH} />{remaining !== null && <Text className={remaining < 0 ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{remaining} characters remaining</Text>}</View>
      </View>
      <DialogFooter><Button variant='outline' onPress={() => onOpenChange(false)}><Text>Cancel</Text></Button><Button onPress={save} disabled={!markId || note.length > ROUTE_POINT_NOTE_MAX_LENGTH}><Text>Save</Text></Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
