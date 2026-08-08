import * as React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { H1 } from '~/components/ui';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import { useBoatProfile } from '../hooks/useBoatProfile';
import { BoatProfilePicker } from './BoatProfilePicker';

export function BoatProfileGate({ children }: React.PropsWithChildren) {
  const { boatProfile } = useBoatProfile();
  const { isDarkColorScheme } = useColorScheme();

  if (!boatProfile) {
    return (
      <GestureHandlerRootView className='w-full h-full flex-1'>
        <View
          className='flex-1 justify-center items-center px-10 py-5'
          style={{
            backgroundColor: isDarkColorScheme
              ? NAV_THEME.dark.background
              : NAV_THEME.light.background,
          }}
        >
          <H1 className='mb-4'>Select Boat Profile</H1>
          <BoatProfilePicker />
        </View>
      </GestureHandlerRootView>
    );
  }

  return <>{children}</>;
}
