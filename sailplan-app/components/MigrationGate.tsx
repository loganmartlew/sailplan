import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import migrations from '~/drizzle/migrations';
import { db, expoDb } from '~/lib/db';
import { Text } from '~/components/ui';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';

const getStyles = (isDarkColorScheme: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDarkColorScheme
        ? NAV_THEME.dark.background
        : NAV_THEME.light.background,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export function MigrationGate({ children }: React.PropsWithChildren) {
  const { success, error } = useMigrations(db, migrations);
  useDrizzleStudio(expoDb);
  const { isDarkColorScheme } = useColorScheme();

  React.useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  if (error) {
    return (
      <View style={getStyles(isDarkColorScheme).container}>
        <Text>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={getStyles(isDarkColorScheme).container}>
        <Text>Migration is in progress...</Text>
      </View>
    );
  }

  return <>{children}</>;
}
