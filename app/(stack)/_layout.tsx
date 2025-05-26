import { Stack } from 'expo-router';
import { BackButton } from '~/components/BackButton';

export default function StackLayout() {
  return (
    <Stack
      screenOptions={{
        headerLeft: () => <BackButton />,
      }}
    />
  );
}
