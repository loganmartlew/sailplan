import { Pressable, View } from 'react-native';
import { Sail } from '../model/sail';
import { Button, H3 } from '~/components/ui';
import { Pencil } from '~/lib/icons/Pencil';
import { Trash } from '~/lib/icons/Trash';

interface SailListItemProps {
  sail: Sail;
  onEdit?: (sail: Sail) => void;
  onDelete?: (sail: Sail) => void;
  onPress?: (sail: Sail) => void;
}

export function SailListItem({
  sail,
  onEdit,
  onDelete,
  onPress,
}: SailListItemProps) {
  const content = (
    <>
      <H3>{sail.name}</H3>
      <View className='flex flex-row gap-1'>
        {onEdit && (
          <Button variant='ghost' size='icon' onPress={() => onEdit(sail)}>
            <Pencil className='text-foreground' size={18} />
          </Button>
        )}
        {onDelete && (
          <Button variant='ghost' size='icon' onPress={() => onDelete(sail)}>
            <Trash className='text-destructive' size={18} />
          </Button>
        )}
      </View>
    </>
  );

  return (
    <>
      {onPress ? (
        <Pressable
          className='flex flex-row gap-3 justify-between'
          onPress={() => onPress(sail)}
        >
          {content}
        </Pressable>
      ) : (
        <View className='flex flex-row gap-3 justify-between'>{content}</View>
      )}
    </>
  );
}
