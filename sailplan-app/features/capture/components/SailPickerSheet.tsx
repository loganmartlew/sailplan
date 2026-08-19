import {
  FlatList,
  Modal,
  Pressable,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { H3, Text } from '~/components/ui';
import type { Sail } from '~/features/sail';

export type PickableSail = Pick<Sail, 'id' | 'name' | 'color'>;

interface SailPickerSheetProps {
  open: boolean;
  sails: readonly PickableSail[];
  heading: string;
  subtitle: string;
  /** Verb the tiles announce, so a screen reader says what tapping does. */
  action: string;
  emptyMessage: string;
  disabled?: boolean;
  /**
   * A tile above the sails for "none of these". Review needs it — clearing a
   * block is the same act as attributing one, and giving it a second control
   * beside the picker made the two read as different kinds of thing. Stamping
   * has nothing to clear, so it passes none.
   */
  clearOption?: { label: string; action: string; onSelect: () => void };
  onClose: () => void;
  onSelect: (sail: PickableSail) => void;
}

/**
 * Thumb-sized, colour-filled sail tiles. Shared by the two places the app asks
 * which sail was up: stamping on the recording bar ("this instant only") and
 * attributing a block in review ("this block"), which differ only in what they
 * are claiming — hence the heading and subtitle being props.
 */
export function SailPickerSheet({
  open,
  sails,
  heading,
  subtitle,
  action,
  emptyMessage,
  disabled = false,
  clearOption,
  onClose,
  onSelect,
}: SailPickerSheetProps) {
  const stopPropagation = (event: GestureResponderEvent) =>
    event.stopPropagation();

  return (
    <Modal
      visible={open}
      transparent
      animationType='slide'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className='flex-1 justify-end bg-black/60'
        onPress={onClose}
        accessibilityRole='button'
        accessibilityLabel='Close sail picker'
      >
        <Pressable
          className='max-h-[72%] rounded-t-3xl bg-background px-4 pb-5 pt-4'
          onPress={stopPropagation}
        >
          <View className='mb-4 items-center gap-3'>
            <View className='h-1.5 w-12 rounded-full bg-muted' />
            <H3 className='pb-0'>{heading}</H3>
            <Text className='text-center text-sm text-muted-foreground'>
              {subtitle}
            </Text>
          </View>
          <FlatList
            data={sails}
            numColumns={2}
            keyExtractor={sail => String(sail.id)}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            showsVerticalScrollIndicator
            ListHeaderComponent={
              clearOption ? (
                <Pressable
                  className='mb-3 h-16 items-center justify-center rounded-2xl border border-dashed border-border active:opacity-80'
                  disabled={disabled}
                  onPress={clearOption.onSelect}
                  accessibilityRole='button'
                  accessibilityLabel={clearOption.action}
                >
                  <Text className='text-lg font-semibold'>{clearOption.label}</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                className='h-24 flex-1 overflow-hidden rounded-2xl border border-border active:opacity-80'
                style={{ backgroundColor: item.color.toLowerCase() || '#888' }}
                disabled={disabled}
                onPress={() => onSelect(item)}
                accessibilityRole='button'
                accessibilityLabel={`${action} ${item.name}`}
              >
                <View className='flex-1 items-center justify-center bg-black/25 px-2'>
                  <Text className='text-center text-xl font-bold text-white'>
                    {item.name}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className='py-8 text-center text-muted-foreground'>
                {emptyMessage}
              </Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
