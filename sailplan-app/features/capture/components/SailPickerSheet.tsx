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

/**
 * Thumb-sized, colour-filled sail tiles. Shared by the two places the app asks
 * which sail was up: stamping on the recording bar ("this instant only") and
 * attributing a block in review ("this block"), which differ only in what they
 * are claiming — hence the heading and subtitle being props.
 */
export function SailPickerSheet<TSail extends PickableSail>({
  open,
  sails,
  heading,
  subtitle,
  emptyMessage,
  disabled = false,
  onClose,
  onSelect,
}: {
  open: boolean;
  sails: readonly TSail[];
  heading: string;
  subtitle: string;
  emptyMessage: string;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (sail: TSail) => void;
}) {
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
            renderItem={({ item }) => (
              <Pressable
                className='h-24 flex-1 overflow-hidden rounded-2xl border border-border active:opacity-80'
                style={{ backgroundColor: item.color.toLowerCase() || '#888' }}
                disabled={disabled}
                onPress={() => onSelect(item)}
                accessibilityRole='button'
                accessibilityLabel={item.name}
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
