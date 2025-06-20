import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useColorScheme } from '~/lib/useColorScheme';

interface AlertOptions {
  title: string;
  message: string;
  confirmText: string;
}

export function useAlert() {
  const { isDarkColorScheme } = useColorScheme();

  const alert = useCallback(
    ({
      title = 'Alert',
      message = 'Are you sure?',
      confirmText = 'Yes',
    }: AlertOptions) => {
      return new Promise<boolean>(resolve => {
        Alert.alert(
          title,
          message,
          [
            {
              text: confirmText,
              style: 'default',
              onPress: () => resolve(true),
            },
          ],
          {
            userInterfaceStyle: isDarkColorScheme ? 'dark' : 'light',
          }
        );
      });
    },
    [isDarkColorScheme]
  );

  return alert;
}
