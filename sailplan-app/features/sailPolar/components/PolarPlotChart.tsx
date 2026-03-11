import {
  useFont,
  Path,
  Skia,
  Circle,
  Text as SkText,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '~/components/ui';
import { useColorScheme } from '~/lib/useColorScheme';
import type { SailPolar } from '../model/sailPolar';
import {
  groupPolarsByTws,
  getUniqueTwsValues,
  getTwsColorScale,
  toCartesian,
  generateAllTwsCurves,
  getTwsInterpolationColorScale,
  INTERPOLATION_TWS_VALUES,
  type InterpolationCurvePoint,
} from '../util/chartData';

// @ts-expect-error - ttf import
import font from '~/assets/fonts/SpaceMono-Regular.ttf';

const CHART_SIZE = 470;
const PADDING = 40;
const RADIUS = CHART_SIZE / 2 - PADDING / 2; // 140
const CENTER_X = PADDING * 1.8;
const CENTER_Y = RADIUS + PADDING; // 180 — vertically centred with room above

const MAX_SPEED = 30; // kn — hard-coded TWS range
const GRID_STEPS = [5, 10, 15, 20, 25, 30];
const TWA_LINES = [0, 30, 60, 90, 120, 150, 180];

const TWA_LINE_SMOOTHING = 3;

interface PolarPlotChartProps {
  polars: SailPolar[];
  showScatter?: boolean;
  showInterpolation?: boolean;
}

export function PolarPlotChart({
  polars,
  showScatter = true,
  showInterpolation = false,
}: PolarPlotChartProps) {
  const skFont = useFont(font, 10);
  const { isDarkColorScheme } = useColorScheme();

  const twsValues = getUniqueTwsValues(polars);
  const colorScale = getTwsColorScale(twsValues);
  const groups = groupPolarsByTws(polars);

  const interpolationCurves = useMemo(
    () => (showInterpolation ? generateAllTwsCurves(polars) : new Map()),
    [polars, showInterpolation],
  );

  const interpolationColors = useMemo(
    () => getTwsInterpolationColorScale(INTERPOLATION_TWS_VALUES),
    [],
  );

  if (polars.length === 0) return null;

  const scale = RADIUS / MAX_SPEED;

  const gridColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(0,0,0,0.12)';
  const labelColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.6)'
    : 'rgba(0,0,0,0.5)';

  return (
    <View className='flex gap-4 flex-1'>
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
            showScatter={showScatter}
            showInterpolation={showInterpolation}
            interpolationCurves={interpolationCurves}
            interpolationColors={interpolationColors}
          />
        </View>
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
              position: 'absolute',
              left: CENTER_X - 52,
              top: PADDING + RADIUS / 2 - 15,
              transform: [{ rotate: '-90deg' }],
              width: 80,
            }}
          >
            Boat Speed (kn)
          </Text>
        </View>
      </View>
      {showInterpolation && <TwsLegend colors={interpolationColors} />}
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
  showScatter,
  showInterpolation,
  interpolationCurves,
  interpolationColors,
}: {
  gridSteps: number[];
  gridMax: number;
  scale: number;
  gridColor: string;
  labelColor: string;
  groups: Map<number, { twa: number; speed: number }[]>;
  colorScale: Map<number, string>;
  skFont: ReturnType<typeof useFont>;
  showScatter: boolean;
  showInterpolation: boolean;
  interpolationCurves: Map<number, InterpolationCurvePoint[][]>;
  interpolationColors: Map<number, string>;
}) {
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

      {/* Data lines per TWS group (scatter) */}
      {showScatter &&
        Array.from(groups.entries()).map(([tws, points]) => {
          if (points.length < 2) {
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

      {/* Interpolation TWS curves */}
      {showInterpolation &&
        Array.from(interpolationCurves.entries()).map(([tws, segments]) => {
          const color = interpolationColors.get(tws) ?? 'hsl(210, 85%, 55%)';

          return segments.map((segment, segIdx) => {
            if (segment.length < 2) return null;

            // Convert to screen coordinates
            const pts = segment.map(p => {
              const c = toCartesian(p.twa, p.speed);
              return { x: CENTER_X + c.x * scale, y: CENTER_Y - c.y * scale };
            });

            // Build smooth path using Catmull-Rom → cubic Bézier
            const path = Skia.Path.Make();
            path.moveTo(pts[0].x, pts[0].y);

            for (let i = 0; i < pts.length - 1; i++) {
              const p0 = pts[Math.max(i - 1, 0)];
              const p1 = pts[i];
              const p2 = pts[i + 1];
              const p3 = pts[Math.min(i + 2, pts.length - 1)];

              const cp1x = p1.x + (p2.x - p0.x) / TWA_LINE_SMOOTHING;
              const cp1y = p1.y + (p2.y - p0.y) / TWA_LINE_SMOOTHING;
              const cp2x = p2.x - (p3.x - p1.x) / TWA_LINE_SMOOTHING;
              const cp2y = p2.y - (p3.y - p1.y) / TWA_LINE_SMOOTHING;

              path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }

            return (
              <Path
                key={`interp-${tws}-${segIdx}`}
                path={path}
                color={color}
                style='stroke'
                strokeWidth={2}
                strokeJoin='round'
                strokeCap='round'
              />
            );
          });
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
  const path = Skia.Path.Make();
  path.addArc(
    { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 },
    -90,
    180,
  );
  return <Path path={path} color={color} style='stroke' strokeWidth={1} />;
}

function TwsLegend({ colors }: { colors: Map<number, string> }) {
  return (
    <View className='flex-row flex-wrap gap-3 justify-center'>
      {INTERPOLATION_TWS_VALUES.map(tws => (
        <View key={tws} className='flex-row items-center gap-1.5'>
          <View
            style={{
              backgroundColor: colors.get(tws),
              width: 16,
              height: 3,
              borderRadius: 2,
            }}
          />
          <Text className='text-xs text-muted-foreground'>{tws} kn</Text>
        </View>
      ))}
    </View>
  );
}
