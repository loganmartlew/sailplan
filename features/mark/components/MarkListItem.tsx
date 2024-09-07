import { View } from 'react-native';
import { Mark } from '../model/mark';
import { Button, H3, Text } from '~/components/ui';
import { Pencil } from '~/lib/icons/Pencil';
import { Trash } from '~/lib/icons/Trash';

interface MarkListItemProps {
  mark: Mark;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MarkListItem({ mark }: MarkListItemProps) {
  return (
    <View className='flex flex-row gap-3 justify-between'>
      <H3>{mark.name}</H3>
      <View className='flex flex-row gap-1'>
        <Button variant='ghost' size='icon'>
          <Pencil className='text-foreground' size={18} />
        </Button>
        <Button variant='ghost' size='icon'>
          <Trash className='text-destructive' size={18} />
        </Button>
      </View>
    </View>
  );
}
