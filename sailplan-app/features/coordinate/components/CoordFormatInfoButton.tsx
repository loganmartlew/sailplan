import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Text,
} from '~/components/ui';
import { Info } from '~/lib/icons';
import { View } from 'react-native';

export function CoordFormatInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        className='h-6 w-6'
        onPress={() => setOpen(true)}
      >
        <Info className='text-muted-foreground' size={15} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='w-[500px] max-w-[100vw]'>
          <DialogHeader>
            <DialogTitle>Coordinate Formats</DialogTitle>
          </DialogHeader>
          <View className='flex gap-4'>
            <View className='flex gap-1'>
              <Text className='font-semibold'>
                DMS — Degrees Minutes Seconds
              </Text>
              <Text className='text-sm text-muted-foreground'>
                Splits a coordinate into degrees, whole minutes, and decimal
                seconds. Example: 36° 51′ 21.6″ S
              </Text>
            </View>
            <View className='flex gap-1'>
              <Text className='font-semibold'>
                DMM — Degrees Decimal Minutes
              </Text>
              <Text className='text-sm text-muted-foreground'>
                Splits a coordinate into degrees and decimal minutes (no
                seconds). Commonly used in marine GPS devices. Example: 36°
                51.360′ S
              </Text>
            </View>
          </View>
          <DialogClose asChild>
            <Button>
              <Text>Got it</Text>
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
