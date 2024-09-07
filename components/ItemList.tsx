import { ScrollView } from 'react-native-gesture-handler';
import { Text } from './ui';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ItemListProps<TItem> {
  items?: TItem[] | null;
  renderItem: (item: TItem) => ReactNode;
  noItemsMessage?: string;
}

export function ItemList<TItem extends { id: string | number }>({
  items,
  renderItem,
  noItemsMessage = 'No items',
}: ItemListProps<TItem>) {
  const { bottom } = useSafeAreaInsets();

  if (!items || items.length === 0) {
    return <Text className='text-center'>{noItemsMessage}</Text>;
  }

  return (
    <ScrollView>
      <View className='flex gap-3' style={{ paddingBottom: bottom }}>
        {items.map(item => (
          <View key={item.id}>{renderItem(item)}</View>
        ))}
      </View>
    </ScrollView>
  );
}
