import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart } from 'victory-native';
import { Circle, useFont } from '@shopify/react-native-skia';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
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
  for (const p of polars) {
    speedMap.set(`${p.twa}_${p.tws}`, p.speed);
  }
  return { data, speedMap };
}

export function ScatterChart({ polars }: ScatterChartProps) {
  const skFont = useFont(font, 11);
  const { isDarkColorScheme } = useColorScheme();
  const { data, speedMap } = useMemo(() => prepareData(polars), [polars]);

  if (data.length === 0) return null;

  const labelColor = isDarkColorScheme ? '#aaa' : '#666';
  const lineColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(0,0,0,0.12)';

  return (
    <View className='flex gap-4'>
      <View style={{ flexDirection: 'row', height: 320 }}>
        <View
          style={{
            width: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            className='text-xs text-muted-foreground'
            style={{
              transform: [{ rotate: '-90deg' }, { translateY: -5 }],
              width: 60,
            }}
          >
            TWS (kn)
          </Text>
        </View>
        <View style={{ flex: 1 }}>
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
                      color={getSpeedColor(speed)}
                    />
                  );
                },
              )
            }
          </CartesianChart>
        </View>
      </View>
      <SpeedLegend />
    </View>
  );
}

const LEGEND_TICKS = [0, 5, 10, 15, 20];
const BAR_WIDTH = 260;
const BAR_HEIGHT = 12;
const LEGEND_PAD = 10;
const GRADIENT_STOPS = 10;

function SpeedLegend() {
  const { isDarkColorScheme } = useColorScheme();
  const labelColor = isDarkColorScheme ? '#aaa' : '#666';

  const stops = Array.from({ length: GRADIENT_STOPS + 1 }, (_, i) => {
    const t = i / GRADIENT_STOPS;
    return { offset: `${Math.round(t * 100)}%`, color: getSpeedColor(t * 20) };
  });

  return (
    <View className='items-center'>
      <Svg width={BAR_WIDTH + LEGEND_PAD * 2} height={45}>
        <Defs>
          <LinearGradient id='speedGrad' x1='0' y1='0' x2='1' y2='0'>
            {stops.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect
          x={LEGEND_PAD}
          y={0}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          rx={3}
          fill='url(#speedGrad)'
        />
        {LEGEND_TICKS.map(speed => {
          const x = LEGEND_PAD + (speed / 20) * BAR_WIDTH;
          const label = speed === 20 ? '20+' : `${speed}`;
          return (
            <SvgText
              key={speed}
              x={x}
              y={BAR_HEIGHT + 14}
              fontSize={10}
              fill={labelColor}
              textAnchor='middle'
            >
              {label}
            </SvgText>
          );
        })}
        <SvgText
          x={LEGEND_PAD + BAR_WIDTH / 2}
          y={BAR_HEIGHT + 28}
          fontSize={10}
          fill={labelColor}
          textAnchor='middle'
        >
          Boat Speed (kn)
        </SvgText>
      </Svg>
    </View>
  );
}
