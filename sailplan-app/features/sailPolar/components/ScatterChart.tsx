import { View } from 'react-native';
import { CartesianChart, Scatter } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { Text } from '~/components/ui';
import { useColorScheme } from '~/lib/useColorScheme';
import type { SailPolar } from '../model/sailPolar';
import { getUniqueTwsValues, getTwsColorScale } from '../util/chartData';

// @ts-expect-error - ttf import
import font from '~/assets/fonts/SpaceMono-Regular.ttf';

interface ScatterChartProps {
  polars: SailPolar[];
}

/**
 * Prepare data for CartesianChart.
 * Each data point has twa (x), and one yKey per TWS value.
 * Points not belonging to a TWS group get null for that yKey.
 */
function prepareScatterData(polars: SailPolar[]) {
  const twsValues = getUniqueTwsValues(polars);
  const yKeys = twsValues.map(tws => `tws_${tws}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = polars.map(p => {
    const point: Record<string, number | null> = { twa: p.twa };
    for (const tws of twsValues) {
      point[`tws_${tws}`] = tws === p.tws ? p.speed : null;
    }
    return point;
  });

  return { data, yKeys, twsValues };
}

export function ScatterChart({ polars }: ScatterChartProps) {
  const skFont = useFont(font, 11);
  const { isDarkColorScheme } = useColorScheme();

  const twsValues = getUniqueTwsValues(polars);
  const colorScale = getTwsColorScale(twsValues);
  const { data, yKeys } = prepareScatterData(polars);

  if (data.length === 0 || yKeys.length === 0) return null;

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
          yKeys={yKeys as any}
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
            yKeys.map((key, i) => {
              const tws = twsValues[i];
              return (
                <Scatter
                  key={key}
                  points={points[key]}
                  radius={4}
                  shape='circle'
                  style='fill'
                  color={colorScale.get(tws) ?? 'hsl(210, 80%, 50%)'}
                />
              );
            })
          }
        </CartesianChart>
      </View>
      {/* <ChartLegend twsValues={twsValues} colorScale={colorScale} /> */}
    </View>
  );
}

// function ChartLegend({
//   twsValues,
//   colorScale,
// }: {
//   twsValues: number[];
//   colorScale: Map<number, string>;
// }) {
//   return (
//     <View className='flex-row flex-wrap gap-3 px-2'>
//       {twsValues.map(tws => (
//         <View key={tws} className='flex-row items-center gap-1.5'>
//           <View
//             style={{
//               width: 8,
//               height: 8,
//               borderRadius: 4,
//               backgroundColor: colorScale.get(tws),
//             }}
//           />
//           <Text className='text-xs text-muted-foreground'>{tws} kn</Text>
//         </View>
//       ))}
//     </View>
//   );
// }
