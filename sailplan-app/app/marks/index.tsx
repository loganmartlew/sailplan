import { Link, router } from 'expo-router';
import { View, FlatList, Pressable } from 'react-native';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, H2, Muted, Text } from '~/components/ui';
import { MarkRouteUsage } from '~/features/course';
import {
  useMarks,
  Mark,
  MarkListItem,
  deleteMark,
  MarkInUseError,
  MarkShareDialog,
} from '~/features/mark';
import { useConfirm } from '~/hooks/useConfirm';
import { Plus, MapPin, Share2 } from '~/lib/icons';
import { useState } from 'react';

export default function Marks() {
  const confirm = useConfirm();
  const marksQuery = useMarks();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [blockedUsage, setBlockedUsage] = useState<MarkRouteUsage | null>(null);

  const onMarkEdit = (mark: Mark) => {
    router.push({
      pathname: '/marks/[markId]',
      params: { markId: mark.id.toString() },
    });
  };

  const onMarkDelete = async (mark: Mark) => {
    const proceed = await confirm({
      title: 'Delete Mark',
      message: `Are you sure you want to delete ${mark.name}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!proceed) return;

    try {
      await deleteMark(mark.id);
    } catch (error) {
      if (!(error instanceof MarkInUseError)) throw error;
      setBlockedUsage(error.usage);
    }
  };

  return (
    <View className='flex-1 w-full px-3 py-5 pb-0 flex flex-col gap-6'>
      <View className='flex gap-4'>
        <View className='flex-row items-center justify-between'>
          <H2 className='pb-0'>Marks</H2>
          {marksQuery.data?.length > 0 && (
            <Badge variant='transparent'>
              <Text className='text-sm'>
                {marksQuery.data.length}{' '}
                {marksQuery.data.length === 1 ? 'mark' : 'marks'}
              </Text>
            </Badge>
          )}
        </View>
        <View className='flex-row gap-2'>
          <Link href='/marks/new' push asChild>
            <Button className='flex-1 flex-row gap-2'>
              <Plus className='text-primary-foreground' size={18} />
              <Text>New Mark</Text>
            </Button>
          </Link>
          <Link href='/marks/map' push asChild>
            <Button variant='secondary' className='flex-1 flex-row gap-2'>
              <MapPin className='text-secondary-foreground' size={18} />
              <Text>Map</Text>
            </Button>
          </Link>
          <Button
            variant='secondary'
            className='flex-row gap-2'
            onPress={() => setShareDialogOpen(true)}
          >
            <Share2 className='text-secondary-foreground' size={18} />
          </Button>
        </View>
      </View>
      <FlatList
        data={marksQuery.data}
        keyExtractor={item => item.id.toString()}
        contentContainerClassName='gap-3'
        renderItem={({ item }) => (
          <MarkListItem
            mark={item}
            onDelete={onMarkDelete}
            onEdit={onMarkEdit}
          />
        )}
        ListEmptyComponent={
          <View className='flex items-center justify-center p-10 gap-2'>
            <MapPin className='text-muted-foreground' size={32} />
            <Muted>No marks yet</Muted>
          </View>
        }
      />
      <MarkShareDialog
        open={shareDialogOpen}
        onOpenChange={val => setShareDialogOpen(val)}
      />
      <Dialog open={!!blockedUsage} onOpenChange={open => !open && setBlockedUsage(null)}><DialogContent><DialogHeader><DialogTitle>Mark in use</DialogTitle></DialogHeader><Text>This Mark cannot be deleted until every Course use is removed.</Text><View className='gap-2'>{blockedUsage?.uses.map((use, index) => <Pressable key={`${use.courseId}:${index}`} onPress={() => { setBlockedUsage(null); router.push({ pathname: '/courses/(course)/[courseId]', params: { courseId: use.courseId.toString() } }); }}><View className='rounded-xl bg-muted p-3'><Text className='font-semibold'>{use.courseName}</Text><Text className='text-sm text-muted-foreground'>{use.role === 'courseMark' ? 'Course Mark' : `Via Point in ${use.legName}`}</Text></View></Pressable>)}</View></DialogContent></Dialog>
    </View>
  );
}
