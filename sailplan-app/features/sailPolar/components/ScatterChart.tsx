import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart } from 'victory-native';
import { Circle, useFont } from '@shopify/react-native-skia';
import { Text } from '~/components/ui';
import { useColorScheme } from '~/lib/useColorScheme';
import type { SailPolar } from '../model/sailPolar';
import { getSpeedColor } from '../util/chartData';

// @ts-expect-error - ttf import
import font from '~/assets/fonts/SpaceMono-Regular.ttf';

interface ScatterChartProps {
  polars: SailPolar[];
}

function prepareData(polars: SailPolar[]) {
  const data = polars.map(p => ({ twa: p.twa, tws: p.tws }));
  const speedMap = new Map<string, number>();
  let maxSpeed = 0;
  for (const p of polars) {
    speedMap.set(`${p.twa}_${p.tws}`, p.speed);
    if (p.speed > maxSpeed) maxSpeed = p.speed;
  }
  return { data, speedMap, maxSpeed };
}

export function ScatterChart({ polars }: ScatterChartProps) {
  const skFont = useFont(font, 11);
  const { isDarkColorScheme } = useColorScheme();
  const { data, speedMap, maxSpeed } = useMemo(
    () => prepareData(polars),
    [polars],
  );

  if (data.length === 0) return null;

  const labelColor = isDarkColorScheme ? '#aaa' : '#666';
  const lineColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(0,0,0,0.12)';

  return (
    <View className='flex gap-4'>
      <View style={{ height: 320 }}>
        <CartesianChart
          data={data}
          xKey='twa'
          yKeys={['tws']}
          domain={{ x: [0, 180], y: [0, 30] }}
          domainPadding={{ top: 10, right: 20, bottom: 5, left: 0 }}
          xAxis={{
            font: skFont,
            labelColor,
            lineColor,
            tickValues: [0, 30, 60, 90, 120, 150, 180],
            formatXLabel: v => `${v}°`,
          }}
          yAxis={[
            {
              font: skFont,
              labelColor,
              lineColor,
              tickValues: [0, 5, 10, 15, 20, 25, 30],
              formatYLabel: v => `${v ?? ''}`,
            },
          ]}
          frame={{ lineColor }}
        >
          {({ points }: { points: Record<string, any> }) =>
            points.tws.map(
              (
                pt: { x: number; y: number; xValue: number; yValue: number },
                i: number,
              ) => {
                if (typeof pt.y !== 'number') return null;
                const speed = speedMap.get(`${pt.xValue}_${pt.yValue}`) ?? 0;
                return (
                  <Circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={5}
                    color={getSpeedColor(speed, maxSpeed)}
                  />
                );
              },
            )
          }
        </CartesianChart>
      </View>
      <SpeedLegend maxSpeed={maxSpeed} />
    </View>
  );
}

function SpeedLegend({ maxSpeed }: { maxSpeed: number }) {
  const steps = 5;
  const labels: { speed: number; color: string }[] = [];
  for (let i = 0; i <= steps; i++) {
    const speed = Math.round((maxSpeed / steps) * i * 10) / 10;
    labels.push({ speed, color: getSpeedColor(speed, maxSpeed) });
  }

  return (
    <View className='flex-row items-center justify-center gap-1 px-2'>
      <Text className='text-xs text-muted-foreground mr-1'>Speed:</Text>
      {labels.map(({ speed, color }) => (
        <View key={speed} className='flex-row items-center gap-0.5'>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
            }}
          />
          <Text className='text-xs text-muted-foreground'>{speed}</Text>
        </View>
      ))}
      <Text className='text-xs text-muted-foreground ml-0.5'>kn</Text>
    </View>
  );
}
