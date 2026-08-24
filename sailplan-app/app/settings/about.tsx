import { Image, Pressable, View } from 'react-native';
import { Label, Separator, Text } from '~/components/ui';
import { ChevronRight, Flag, Github } from '~/lib/icons';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

const GITHUB_URL = 'https://github.com/loganmartlew/sailplan';

export default function AboutSettings() {
  const version = Constants.expoConfig?.version ?? 'Unknown';

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-8'>
      <View className='flex items-center gap-3 py-4'>
        <Image
          source={require('~/assets/images/icon.png')}
          className='w-20 h-20 rounded-2xl'
        />
        <View className='flex items-center gap-1'>
          <Text className='text-xl font-bold'>SailPlan</Text>
          <Text className='text-sm text-muted-foreground'>
            Version {version}
          </Text>
        </View>
        <Text className='text-sm text-muted-foreground text-center px-4'>
          An app for checking angles between marks, and selecting the best sail.
        </Text>
      </View>

      <Separator />

      <View className='flex gap-2'>
        <Label className='pl-1.5'>Links</Label>
        <LinkItem
          icon={<Github className='text-foreground' size={18} />}
          label='Source Code'
          description='View the project on GitHub'
          onPress={() => WebBrowser.openBrowserAsync(GITHUB_URL)}
        />
        <LinkItem
          icon={<Flag className='text-foreground' size={18} />}
          label='Report an Issue'
          description='Submit a bug report or feature request'
          onPress={() => WebBrowser.openBrowserAsync(`${GITHUB_URL}/issues`)}
        />
      </View>
    </View>
  );
}

function LinkItem({
  icon,
  label,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className='flex-row items-center justify-between py-3 px-1.5'
    >
      <View className='flex-row items-center gap-3 shrink'>
        {icon}
        <View className='flex gap-0.5 shrink'>
          <Text className='text-base'>{label}</Text>
          <Text className='text-sm text-muted-foreground'>{description}</Text>
        </View>
      </View>
      <ChevronRight className='text-muted-foreground' size={16} />
    </Pressable>
  );
}
