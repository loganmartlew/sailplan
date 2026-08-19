import { useLocalSearchParams } from 'expo-router';
import { SailedLegReview } from '~/features/capture';

export default function SailedLegReviewScreen() {
  const params = useLocalSearchParams<{ sessionId: string; ordinal: string }>();

  return (
    <SailedLegReview
      sessionId={Number(params.sessionId)}
      ordinal={Number(params.ordinal)}
    />
  );
}
