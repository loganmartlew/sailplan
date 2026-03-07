import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import { H2, Label, Text } from '~/components/ui';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui';
import { useColorScheme } from '~/lib/useColorScheme';
import type { ThemePreference } from '~/features/settings';

export default function AppearanceSettings() {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <View className='flex-1 w-full px-3 py-5 flex flex-col gap-8'>
      <H2 className='pb-0'>Appearance</H2>

      <View className='flex gap-2'>
        <Label>Theme</Label>
        <Text className='text-sm text-muted-foreground'>
          Choose between light and dark theme
        </Text>
        <ToggleGroup
          type='single'
          value={colorScheme}
          onValueChange={value => {
            if (value) {
              setColorScheme(value as ThemePreference);
              AsyncStorage.setItem('theme', value);
            }
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='light' className='flex-1'>
            <Text>Light</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='dark' className='flex-1'>
            <Text>Dark</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>
    </View>
  );
}
