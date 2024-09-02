import { Drawer } from 'expo-router/drawer';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { H2, Text } from '~/components/ui';
import { BoatProfilePicker } from '~/features/boatProfile';
import { useBoatProfile } from '~/features/boatProfile/hooks/useBoatProfile';
import { DrawerContent } from '~/features/navigation';
import { HeaderMenuButton } from '~/features/navigation/HeaderMenuButton';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';

const drawerStyles = StyleSheet.create({
  drawerItem: {
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 4,
  },
});

export default function AppLayout() {
  const { isDarkColorScheme } = useColorScheme();

  const { boatProfile } = useBoatProfile();

  if (!boatProfile)
    return (
      <View className='flex-1 justify-center items-center px-10 py-5'>
        <H2 className='text-center mb-4'>Select a Boat Profile</H2>
        <BoatProfilePicker />
      </View>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={DrawerContent}
        screenOptions={{
          headerLeft: () => (
            <HeaderMenuButton
              color={
                isDarkColorScheme ? NAV_THEME.dark.text : NAV_THEME.light.text
              }
            />
          ),
          headerRight: () => (
            <Text className='italic mr-4'>{boatProfile.name}</Text>
          ),
          drawerItemStyle: drawerStyles.drawerItem,
        }}
      >
        <Drawer.Screen
          name='index'
          options={{
            title: 'Plan',
          }}
        />
        <Drawer.Screen
          name='sails'
          options={{
            title: 'Sails',
          }}
        />
        <Drawer.Screen
          name='marks'
          options={{
            title: 'Marks',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
