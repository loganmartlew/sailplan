import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useColorScheme } from '~/lib/useColorScheme';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
}

export function useConfirm() {
  const { isDarkColorScheme } = useColorScheme();

  const confirm = useCallback(
    ({
      title = 'Confirm',
      message = 'Are you sure?',
      confirmText = 'Yes',
      cancelText = 'No',
      destructive = false,
    }: ConfirmOptions) => {
      return new Promise<boolean>(resolve => {
        Alert.alert(
          title,
          message,
          [
            {
              text: cancelText,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: confirmText,
              style: destructive ? 'destructive' : 'default',
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

  return confirm;
}
