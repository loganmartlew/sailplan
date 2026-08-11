import { ScrollView } from 'react-native';
import { RawLogManager, useCaptureInset } from '~/features/capture';

export default function RawLogsScreen() {
  const captureInset = useCaptureInset();

  return (
    <ScrollView
      className='flex-1'
      contentContainerClassName='w-full px-3 py-5'
      contentContainerStyle={{ paddingBottom: captureInset }}
    >
      <RawLogManager />
    </ScrollView>
  );
}
