import { View } from 'react-native';
import { Mark } from '../model/mark';
import { Button, H3 } from '~/components/ui';
import { Pencil } from '~/lib/icons/Pencil';
import { Trash } from '~/lib/icons/Trash';

interface MarkListItemProps {
  mark: Mark;
  onEdit?: (mark: Mark) => void;
  onDelete?: (mark: Mark) => void;
}

export function MarkListItem({ mark, onEdit, onDelete }: MarkListItemProps) {
  return (
    <View className='flex flex-row gap-3 justify-between'>
      <H3>{mark.name}</H3>
      <View className='flex flex-row gap-1'>
        {onEdit && (
          <Button variant='ghost' size='icon' onPress={() => onEdit(mark)}>
            <Pencil className='text-foreground' size={18} />
          </Button>
        )}
        {onDelete && (
          <Button variant='ghost' size='icon' onPress={() => onDelete(mark)}>
            <Trash className='text-destructive' size={18} />
          </Button>
        )}
      </View>
    </View>
  );
}
