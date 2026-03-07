import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, CardContent, H2, Text } from '~/components/ui';
import { ChevronRight } from '~/lib/icons';

export default function SettingsIndex() {
  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-2'>
      <H2 className='pb-2'>Settings</H2>
      <SettingsNavItem
        title='Units'
        description='Speed, area, and distance units'
        onPress={() => router.push('/settings/units')}
      />
      <SettingsNavItem
        title='Defaults'
        description='Coordinate format, hemisphere, and map zoom'
        onPress={() => router.push('/settings/defaults')}
      />
      <SettingsNavItem
        title='Appearance'
        description='Theme and display'
        onPress={() => router.push('/settings/appearance')}
      />
      <SettingsNavItem
        title='About'
        description='Version, links, and credits'
        onPress={() => router.push('/settings/about')}
      />
    </View>
  );
}

function SettingsNavItem({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardContent className='flex-row items-center justify-between py-4'>
          <View className='flex gap-0.5 shrink'>
            <Text className='text-base font-medium'>{title}</Text>
            <Text className='text-sm text-muted-foreground'>{description}</Text>
          </View>
          <ChevronRight className='text-muted-foreground' size={18} />
        </CardContent>
      </Card>
    </Pressable>
  );
}
