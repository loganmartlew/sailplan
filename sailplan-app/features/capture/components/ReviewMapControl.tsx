import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

interface ReviewMapControlProps {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

/** A round control floated over the review track, inline or fullscreen. */
export function ReviewMapControl({
  label,
  icon: Icon,
  onPress,
}: ReviewMapControlProps) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      onPress={onPress}
      className='h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 active:opacity-70'
    >
      <Icon className='text-foreground' size={18} />
    </Pressable>
  );
}
