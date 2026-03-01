import { View } from 'react-native';
import { Label, Separator, StepperInput, Text } from '~/components/ui';
import { formatAngle } from '~/lib/format';
import { usePlanState } from '../store/planStore';

interface TrueWindInputCardProps {
  tws?: boolean;
  twd?: boolean;
}

export function TrueWindInputCard({ tws, twd }: TrueWindInputCardProps) {
  const { add, currentState } = usePlanState();

  const onTwsChange = (value: string) => {
    const tws = parseInt(value, 10);
    const newTws = Math.max(0, tws);

    if (!isNaN(tws)) {
      add({ tws: newTws });
    } else {
      add({ tws: null });
    }
  };

  const addTws = (amount: number) => {
    const tws = currentState?.tws ?? 0;
    const newTws = Math.max(0, tws + amount);

    add({ tws: newTws });
  };

  const onTwdChange = (value: string) => {
    const twd = parseInt(value, 10);
    const newTwd = (twd + 360) % 360;

    if (!isNaN(twd)) {
      add({ twd: newTwd });
    } else {
      add({ twd: null });
    }
  };

  const addTwd = (amount: number) => {
    const newTwd = ((currentState?.twd ?? 0) + amount + 360) % 360;
    add({ twd: newTwd });
  };

  return (
    <View className='flex gap-4'>
      {tws && (
        <View className='flex gap-2'>
          <Label>True Wind Speed</Label>
          <StepperInput
            onDecrement={() => addTws(-2)}
            onIncrement={() => addTws(2)}
            decrementLabel='-2'
            incrementLabel='+2'
            onChangeText={onTwsChange}
            value={currentState?.tws != null ? `${currentState.tws}` : '0'}
            keyboardType='numeric'
            endAdornment={
              <Text className='ml-1 text-muted-foreground'>kt</Text>
            }
          />
        </View>
      )}
      {tws && twd && <Separator />}
      {twd && (
        <View className='flex gap-2'>
          <Label>True Wind Direction</Label>
          <StepperInput
            onDecrement={() => addTwd(-5)}
            onIncrement={() => addTwd(5)}
            decrementLabel={formatAngle(-5, { signDisplay: 'always' })}
            incrementLabel={formatAngle(5, { signDisplay: 'always' })}
            onChangeText={onTwdChange}
            value={currentState?.twd != null ? `${currentState.twd}` : '0'}
            keyboardType='numeric'
            endAdornment={
              <Text className='ml-1 text-muted-foreground text-xl'>°</Text>
            }
          />
        </View>
      )}
    </View>
  );
}
