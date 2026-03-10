import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '~/components/ui';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui';
import {
  PolarPlotChart,
  ScatterChart,
  useSailPolars,
} from '~/features/sailPolar';
import { useSettings } from '~/features/settings';
import type { PolarChartType } from '~/features/settings';

export default function PolarChartPage() {
  const { sailId } = useLocalSearchParams<{ sailId: string }>();

  const { polarChartType } = useSettings();
  const [chartType, setChartType] = useState<PolarChartType>(polarChartType);
  const { data: polars } = useSailPolars(+sailId);

  if (!polars || polars.length === 0) {
    return (
      <View className='flex-1 items-center justify-center p-10'>
        <Text className='text-muted-foreground'>
          No polar data available for this sail
        </Text>
      </View>
    );
  }

  return (
    <View className='flex-1'>
      <ScrollView
        className='flex-1'
        contentContainerClassName='gap-6 py-4 px-3'
      >
        <ToggleGroup
          type='single'
          value={chartType}
          onValueChange={value => {
            if (value) setChartType(value as PolarChartType);
          }}
          className='flex-row'
        >
          <ToggleGroupItem value='polar' className='flex-1'>
            <Text>Polar</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='scatter' className='flex-1'>
            <Text>Scatter</Text>
          </ToggleGroupItem>
        </ToggleGroup>

        {chartType === 'polar' && <PolarPlotChart polars={polars} />}
        {chartType === 'scatter' && <ScatterChart polars={polars} />}
      </ScrollView>
    </View>
  );
}
