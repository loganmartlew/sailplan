import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, CardContent, H2, Text } from '~/components/ui';
import { RawLogStorageSummary, useCaptureInset } from '~/features/capture';
import {
  ChevronRight,
  Info,
  PaintBucket,
  Ruler,
  Sailboat,
  TextCursorInput,
} from '~/lib/icons';

export default function SettingsIndex() {
  const captureInset = useCaptureInset();

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='w-full px-3 py-5 flex flex-col gap-2'
      contentContainerStyle={{ paddingBottom: captureInset }}
    >
      <H2 className='pb-2'>Settings</H2>
      <SettingsNavItem
        title='Boat Profile'
        description='Name and plotter connection'
        icon={<Sailboat className='text-accent-foreground' size={16} />}
        onPress={() => router.push('/settings/boat-profile')}
      />
      <SettingsNavItem
        title='Units'
        description='Speed, area, and distance units'
        icon={<Ruler className='text-accent-foreground' size={16} />}
        onPress={() => router.push('/settings/units')}
      />
      <SettingsNavItem
        title='Defaults'
        description='Coordinate format, hemisphere, and map zoom'
        icon={<TextCursorInput className='text-accent-foreground' size={16} />}
        onPress={() => router.push('/settings/defaults')}
      />
      <SettingsNavItem
        title='Appearance'
        description='Theme and display'
        icon={<PaintBucket className='text-accent-foreground' size={16} />}
        onPress={() => router.push('/settings/appearance')}
      />
      <RawLogStorageSummary />
      <SettingsNavItem
        title='About'
        description='Version, links, and credits'
        icon={<Info className='text-accent-foreground' size={16} />}
        onPress={() => router.push('/settings/about')}
      />
    </ScrollView>
  );
}

function SettingsNavItem({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardContent className='flex-row items-center justify-between py-4'>
          <View className='flex-row items-center gap-3 shrink'>
            <View className='w-8 h-8 rounded-full bg-accent items-center justify-center'>
              {icon}
            </View>
            <View className='flex gap-0.5 shrink'>
              <Text className='text-base font-medium'>{title}</Text>
              <Text className='text-sm text-muted-foreground'>
                {description}
              </Text>
            </View>
          </View>
          <ChevronRight className='text-muted-foreground' size={18} />
        </CardContent>
      </Card>
    </Pressable>
  );
}
