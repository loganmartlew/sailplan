import {
  useFont,
  Path,
  Skia,
  Circle,
  Text as SkText,
} from '@shopify/react-native-skia';
import { View } from 'react-native';
import { Text } from '~/components/ui';
import { useColorScheme } from '~/lib/useColorScheme';
import type { SailPolar } from '../model/sailPolar';
import {
  groupPolarsByTws,
  getUniqueTwsValues,
  getTwsColorScale,
  toCartesian,
} from '../util/chartData';

// @ts-expect-error - ttf import
import font from '~/assets/fonts/SpaceMono-Regular.ttf';

const CHART_SIZE = 500;
const PADDING = 40;
const RADIUS = CHART_SIZE / 2 - PADDING / 2; // 140
// const CENTER_X = CHART_SIZE / 4 + PADDING / 2; // 180
const CENTER_X = PADDING * 1.5;
const CENTER_Y = RADIUS + PADDING; // 180 — vertically centred with room above

const MAX_SPEED = 30; // kn — hard-coded TWS range
const GRID_STEPS = [5, 10, 15, 20, 25, 30];
const TWA_LINES = [0, 30, 60, 90, 120, 150, 180];

interface PolarPlotChartProps {
  polars: SailPolar[];
}

export function PolarPlotChart({ polars }: PolarPlotChartProps) {
  const skFont = useFont(font, 10);
  const { isDarkColorScheme } = useColorScheme();

  const twsValues = getUniqueTwsValues(polars);
  const colorScale = getTwsColorScale(twsValues);
  const groups = groupPolarsByTws(polars);

  if (polars.length === 0) return null;

  const scale = RADIUS / MAX_SPEED;

  const gridColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(0,0,0,0.12)';
  const labelColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.6)'
    : 'rgba(0,0,0,0.5)';

  return (
    <View className='flex gap-4'>
      <View
        style={{
          width: CHART_SIZE + PADDING,
          height: RADIUS * 2 + PADDING * 2,
        }}
      >
        <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
          <SkiaCanvas
            gridSteps={GRID_STEPS}
            gridMax={MAX_SPEED}
            scale={scale}
            gridColor={gridColor}
            labelColor={labelColor}
            groups={groups}
            colorScale={colorScale}
            skFont={skFont}
          />
        </View>
      </View>
      {/* <ChartLegend twsValues={twsValues} colorScale={colorScale} /> */}
    </View>
  );
}

function SkiaCanvas({
  gridSteps,
  gridMax,
  scale,
  gridColor,
  labelColor,
  groups,
  colorScale,
  skFont,
}: {
  gridSteps: number[];
  gridMax: number;
  scale: number;
  gridColor: string;
  labelColor: string;
  groups: Map<number, { twa: number; speed: number }[]>;
  colorScale: Map<number, string>;
  skFont: ReturnType<typeof useFont>;
}) {
  // Build SVG-style paths for grid and data
  // We use react-native-skia Canvas for rendering
  const { Canvas } = require('@shopify/react-native-skia');

  return (
    <Canvas style={{ flex: 1 }}>
      {/* Grid circles */}
      {gridSteps.map(speed => {
        const r = speed * scale;
        return (
          <HalfCircle
            key={`grid-${speed}`}
            cx={CENTER_X}
            cy={CENTER_Y}
            radius={r}
            color={gridColor}
          />
        );
      })}

      {/* Grid circle labels */}
      {gridSteps.map(speed => {
        const r = speed * scale;
        if (skFont) {
          return (
            <SkText
              key={`label-${speed}`}
              x={CENTER_X + 3}
              y={CENTER_Y - r + 12}
              text={`${speed}`}
              font={skFont}
              color={labelColor}
            />
          );
        }
        return null;
      })}

      {/* TWA angle lines */}
      {TWA_LINES.map(twa => {
        const end = toCartesian(twa, gridMax);
        const path = Skia.Path.Make();
        path.moveTo(CENTER_X, CENTER_Y);
        path.lineTo(CENTER_X + end.x * scale, CENTER_Y - end.y * scale);
        return (
          <Path
            key={`twa-line-${twa}`}
            path={path}
            color={gridColor}
            style='stroke'
            strokeWidth={1}
          />
        );
      })}

      {/* TWA angle labels */}
      {TWA_LINES.map(twa => {
        const labelPos = toCartesian(twa, gridMax + 1.5);
        if (skFont) {
          return (
            <SkText
              key={`twa-label-${twa}`}
              x={CENTER_X + labelPos.x * scale - 8}
              y={CENTER_Y - labelPos.y * scale + 4}
              text={`${twa}°`}
              font={skFont}
              color={labelColor}
            />
          );
        }
        return null;
      })}

      {/* Data lines per TWS group */}
      {Array.from(groups.entries()).map(([tws, points]) => {
        if (points.length < 2) {
          // Single point — draw a dot
          if (points.length === 1) {
            const pt = toCartesian(points[0].twa, points[0].speed);
            return (
              <Circle
                key={`dot-${tws}`}
                cx={CENTER_X + pt.x * scale}
                cy={CENTER_Y - pt.y * scale}
                r={3}
                color={colorScale.get(tws) ?? 'hsl(210, 80%, 50%)'}
              />
            );
          }
          return null;
        }

        const path = Skia.Path.Make();
        const first = toCartesian(points[0].twa, points[0].speed);
        path.moveTo(CENTER_X + first.x * scale, CENTER_Y - first.y * scale);

        return (
          <Path
            key={`data-${tws}`}
            path={path}
            color={colorScale.get(tws) ?? 'hsl(210, 80%, 50%)'}
            style='stroke'
            strokeWidth={2}
            strokeJoin='round'
            strokeCap='round'
          />
        );
      })}
    </Canvas>
  );
}

function HalfCircle({
  cx,
  cy,
  radius,
  color,
}: {
  cx: number;
  cy: number;
  radius: number;
  color: string;
}) {
  // Draw a semicircle arc from 0° to 180° (left half-circle in polar space)
  const path = Skia.Path.Make();
  // Start at −90° (top/upwind), sweep 180° clockwise through rightward (90° reach) to bottom (180° downwind)
  path.addArc(
    { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 },
    -90,
    180,
  );
  return <Path path={path} color={color} style='stroke' strokeWidth={1} />;
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
//               width: 12,
//               height: 3,
//               backgroundColor: colorScale.get(tws),
//               borderRadius: 1,
//             }}
//           />
//           <Text className='text-xs text-muted-foreground'>{tws} kn</Text>
//         </View>
//       ))}
//     </View>
//   );
// }
