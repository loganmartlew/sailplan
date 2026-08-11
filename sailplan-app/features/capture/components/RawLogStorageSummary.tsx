import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, CardContent, Text } from '~/components/ui';
import { ChevronRight, Folder } from '~/lib/icons';
import { formatRawLogBytes } from '../model/rawLogManager';
import { useRawLogManager } from '../hooks/useRawLogManager';

/** Settings entry point for the aggregate storage requirement in ticket 12. */
export function RawLogStorageSummary() {
  const { rawLogBytes } = useRawLogManager();

  return (
    <Pressable onPress={() => router.push('/settings/raw-logs')}>
      <Card>
        <CardContent className='flex-row items-center justify-between py-4'>
          <View className='flex-row items-center gap-3 shrink'>
            <View className='w-8 h-8 rounded-full bg-accent items-center justify-center'>
              <Folder className='text-accent-foreground' size={16} />
            </View>
            <View className='flex gap-0.5 shrink'>
              <Text className='text-base font-medium'>Manage raw logs</Text>
              <Text className='text-sm text-muted-foreground'>
                {formatRawLogBytes(rawLogBytes)} used
              </Text>
            </View>
          </View>
          <ChevronRight className='text-muted-foreground' size={18} />
        </CardContent>
      </Card>
    </Pressable>
  );
}
