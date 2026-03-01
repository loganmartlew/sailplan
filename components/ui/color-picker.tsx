import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
} from 'reanimated-color-picker';
import type { ColorFormatsObject } from 'reanimated-color-picker';
import { useSharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Color from 'color';
import { PaintBucket } from '~/lib/icons';
import { Button } from './button';
import { Text } from './text';

interface ColorPickerButtonProps {
  value: string;
  onChange: (hex: string) => void;
}

function ColorPickerButton({ value, onChange }: ColorPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState(value);
  const currentColor = useSharedValue(value);

  const handleOpen = () => {
    setPendingColor(value);
    setOpen(true);
  };

  const onColorChange = (color: ColorFormatsObject) => {
    'worklet';
    currentColor.value = color.hex;
  };

  const onColorPick = (color: ColorFormatsObject) => {
    setPendingColor(color.hex);
  };

  const handleSelect = () => {
    onChange(pendingColor);
    setOpen(false);
  };

  const colorIsLight = new Color(value?.toLowerCase() || '#888888').isLight();

  return (
    <>
      <Button
        variant='default'
        onPress={handleOpen}
        className='flex-row gap-3 justify-center native:h-12'
        style={{ backgroundColor: value?.toLowerCase() || '#888888' }}
      >
        <PaintBucket size={20} color={colorIsLight ? 'black' : 'white'} />
        <Text
          className='text-sm font-bold'
          style={{ color: colorIsLight ? 'black' : 'white' }}
        >
          {value || 'Select colour'}
        </Text>
      </Button>

      <Modal
        visible={open}
        transparent
        animationType='fade'
        onRequestClose={() => setOpen(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.8)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 16,
            }}
            onPress={() => setOpen(false)}
          >
            <Pressable
              onPress={e => e.stopPropagation()}
              className='w-full max-w-lg gap-4 border border-border bg-background p-6 rounded-lg'
            >
              <Text className='text-lg native:text-xl font-semibold text-foreground'>
                Pick a Colour
              </Text>
              <ColorPicker
                value={pendingColor || '#888888'}
                onChange={onColorChange}
                onCompleteJS={onColorPick}
              >
                <View className='gap-2'>
                  <Preview hideInitialColor />
                  <Panel1 />
                  <HueSlider />
                </View>
              </ColorPicker>
              <Button onPress={handleSelect}>
                <Text>Select</Text>
              </Button>
            </Pressable>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

export { ColorPickerButton };
