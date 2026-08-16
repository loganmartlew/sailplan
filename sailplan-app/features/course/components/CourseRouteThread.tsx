import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, CardContent, H3, Muted, Text } from '~/components/ui';
import { MapPin, Pencil, Plus, Trash, X } from '~/lib/icons';
import { Course } from '../model/course';
import { MarkBackedViaRoutePoint, RouteLeg } from '../model/courseRoute';
import { insertMarkBackedViaPoint, removeViaPoint, updateMarkBackedViaPoint, useCourseRoute } from '../api/courseRoute';
import { routeUndo, RouteUndoAction } from '../util/routeUndo';
import { MarkBackedViaPointDialog, MarkBackedViaPointValues } from './MarkBackedViaPointDialog';

type Editor = { leg: RouteLeg; order: number; point?: MarkBackedViaRoutePoint };
interface CourseRouteThreadProps { course: Course }

export function CourseRouteThread({ course }: CourseRouteThreadProps) {
  const { data: route } = useCourseRoute(course.id);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [undoAction, setUndoAction] = useState<RouteUndoAction | null>(null);
  function offerUndo(action: RouteUndoAction) { routeUndo.offer(action); setUndoAction(action); }

  async function saveViaPoint(values: MarkBackedViaPointValues) {
    if (!editor) return;
    const result = editor.point
      ? await updateMarkBackedViaPoint(editor.point.viaPointId, values)
      : await insertMarkBackedViaPoint({ legStartCourseMarkId: editor.leg.legId, markId: values.markId, order: editor.order, note: values.note });
    offerUndo({ label: editor.point ? 'Via Point updated' : 'Via Point added', inverse: result.undo });
  }

  async function removeMarkBackedViaPoint(point: MarkBackedViaRoutePoint) {
    const result = await removeViaPoint(point.viaPointId);
    offerUndo({ label: 'Via Point removed', inverse: result.undo });
  }

  if (!route || route.points.length === 0) return <CourseMarksFallback course={course} />;

  return <View className='gap-4'>
    <View className='flex-row items-center justify-between'><H3>Route</H3><Badge variant='transparent'><Text className='text-xs'>{route.points.filter(point => point.kind === 'courseMark').length} Course Marks</Text></Badge></View>
    {route.legs.map((leg, legIndex) => <View key={leg.legId} className='gap-2'>
      {legIndex === 0 && <Anchor name={leg.start.name} direction={leg.start.direction} note={leg.start.note} />}
      <Text className='text-xs text-muted-foreground ml-5'>Leg: {leg.start.name} to {leg.end.name}</Text>
      {Array.from({ length: leg.viaPoints.length + 1 }, (_, order) => <View key={`${leg.legId}:${order}`} className='gap-2'>
        <Button variant='ghost' size='sm' className='self-center flex-row gap-1' onPress={() => setEditor({ leg, order })}><Plus size={14} className='text-accent-foreground' /><Text className='text-xs'>Existing Mark</Text></Button>
        {leg.viaPoints[order] && <ViaRow point={leg.viaPoints[order] as MarkBackedViaRoutePoint} onEdit={() => setEditor({ leg, order, point: leg.viaPoints[order] as MarkBackedViaRoutePoint })} onRemove={() => removeMarkBackedViaPoint(leg.viaPoints[order] as MarkBackedViaRoutePoint)} />}
      </View>)}
      <Anchor name={leg.end.name} direction={leg.end.direction} note={leg.end.note} />
    </View>)}
    {undoAction && <View className='flex-row items-center justify-between rounded-xl bg-secondary p-3'><Text>{undoAction.label}</Text><View className='flex-row'><Button variant='ghost' size='sm' onPress={async () => { await routeUndo.undo(); setUndoAction(null); }}><Text>Undo</Text></Button><Button variant='ghost' size='icon' onPress={() => { routeUndo.dismiss(); setUndoAction(null); }}><X size={16} className='text-muted-foreground' /></Button></View></View>}
    {editor && <MarkBackedViaPointDialog open onOpenChange={open => !open && setEditor(null)} bounds={{ startMarkId: editor.leg.start.markId, endMarkId: editor.leg.end.markId }} initial={editor.point ? { markId: editor.point.markId, note: editor.point.note } : undefined} onSave={saveViaPoint} />}
  </View>;
}

interface AnchorProps { name: string; direction: 'port' | 'starboard' | null; note: string | null }
function Anchor({ name, direction, note }: AnchorProps) {
  return <View className='flex-row gap-3 items-start'><View className='w-4 h-4 rounded-full bg-primary mt-1' /><View className='shrink'><Text className='font-semibold'>{name}{direction ? ` · ${direction}` : ''}</Text>{note && <Text numberOfLines={1} className='text-sm text-muted-foreground'>{note}</Text>}</View></View>;
}
interface ViaRowProps { point: MarkBackedViaRoutePoint; onEdit: () => void; onRemove: () => void }
function ViaRow({ point, onEdit, onRemove }: ViaRowProps) {
  return <Card className='ml-5'><CardContent className='p-3 flex-row items-center justify-between'><Pressable onPress={onEdit} className='flex-row gap-2 items-center shrink'><MapPin size={16} className='text-accent-foreground' /><View className='shrink'><View className='flex-row gap-2'><Text className='font-semibold'>{point.name}</Text><Badge variant='secondary'><Text className='text-xs'>Saved Mark Via Point</Text></Badge></View><Text className='text-xs text-muted-foreground'>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</Text>{point.note && <Text numberOfLines={1} className='text-sm text-muted-foreground'>{point.note}</Text>}</View></Pressable><View className='flex-row'><Button variant='ghost' size='icon' onPress={onEdit}><Pencil size={16} className='text-muted-foreground' /></Button><Button variant='ghost' size='icon' onPress={onRemove}><Trash size={16} className='text-destructive' /></Button></View></CardContent></Card>;
}

interface CourseMarksFallbackProps { course: Course }
function CourseMarksFallback({ course }: CourseMarksFallbackProps) { return <View className='items-center p-10 gap-2'><MapPin className='text-muted-foreground' size={32} /><Muted>Add Course Marks below to build {course.name}.</Muted></View>; }
