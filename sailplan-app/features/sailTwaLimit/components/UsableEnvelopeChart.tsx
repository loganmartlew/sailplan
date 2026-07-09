import { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart } from 'victory-native';
import { Path, Skia, useFont } from '@shopify/react-native-skia';
import { Muted, Text } from '~/components/ui';
import type { Sail } from '~/features/sail';
import { useColorScheme } from '~/lib/useColorScheme';
import { interpolateTwaLimits } from '~/features/sailSuggestion/util/limitScoring';
import type { SailTwaLimit } from '../model/sailTwaLimit';
import { TWS_VALUES } from '../model/sailTwaLimit';

// @ts-expect-error - ttf import
import font from '~/assets/fonts/SpaceMono-Regular.ttf';

const TWS_MIN = 0;
const TWS_MAX = 30;
const TWA_MIN = 0;
const TWA_MAX = 180;

interface UsableEnvelopeChartProps {
  sail: Sail;
  twaLimits: SailTwaLimit[];
}

// A type alias (not an interface) so it satisfies CartesianChart's
// `Record<string, unknown>` data constraint.
type EnvelopePoint = {
  tws: number;
  minTwa: number;
  maxTwa: number;
};

/**
 * Samples the sail's usable-TWA envelope across its wind range. For each wind
 * speed we take the interpolated TWA window (blank sides fall back to the full
 * 0–180° span — blank means "no angle restriction", not "not used"), then clip
 * the sampled wind speeds to `[minTws, maxTws]` so the band stops exactly where
 * the sail stops being used. Samples are the grid TWS values inside the range
 * plus its two edges, so the band spans the true range, not just grid points.
 */
function buildEnvelope(sail: Sail, twaLimits: SailTwaLimit[]): EnvelopePoint[] {
  const lo = sail.minTws ?? TWS_MIN;
  const hi = sail.maxTws ?? TWS_MAX;
  if (hi <= lo) return [];

  const xs = [
    lo,
    ...TWS_VALUES.filter(v => v > lo && v < hi),
    hi,
  ].sort((a, b) => a - b);

  return xs.map(tws => {
    const window = interpolateTwaLimits(tws, twaLimits);
    return {
      tws,
      minTwa: Math.max(TWA_MIN, window.minTwa ?? TWA_MIN),
      maxTwa: Math.min(TWA_MAX, window.maxTwa ?? TWA_MAX),
    };
  });
}

export function UsableEnvelopeChart({
  sail,
  twaLimits,
}: UsableEnvelopeChartProps) {
  const skFont = useFont(font, 11);
  const { isDarkColorScheme } = useColorScheme();

  const data = useMemo(
    () => buildEnvelope(sail, twaLimits),
    [sail, twaLimits],
  );

  const hasAnyLimit = twaLimits.some(
    l => l.minTwa != null || l.maxTwa != null,
  );
  const hasWindRange = sail.minTws != null || sail.maxTws != null;

  if ((!hasAnyLimit && !hasWindRange) || data.length < 2) {
    return <Muted>No usable range configured</Muted>;
  }

  const color = sail.color?.toLowerCase() || '#888888';
  const labelColor = isDarkColorScheme ? '#aaa' : '#666';
  const lineColor = isDarkColorScheme
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(0,0,0,0.12)';

  return (
    <View className='flex gap-2'>
      <View style={{ flexDirection: 'row', height: 260 }}>
        <View
          style={{ width: 10, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            className='text-xs text-muted-foreground'
            style={{
              transform: [{ rotate: '-90deg' }, { translateY: -5 }],
              width: 70,
            }}
          >
            TWA (°)
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <CartesianChart
            data={data}
            xKey='tws'
            yKeys={['minTwa', 'maxTwa']}
            domain={{ x: [TWS_MIN, TWS_MAX], y: [TWA_MIN, TWA_MAX] }}
            domainPadding={{ top: 8, right: 12, bottom: 8, left: 8 }}
            xAxis={{
              font: skFont,
              labelColor,
              lineColor,
              tickValues: [0, 5, 10, 15, 20, 25, 30],
              formatXLabel: v => `${v ?? ''}`,
            }}
            yAxis={[
              {
                font: skFont,
                labelColor,
                lineColor,
                tickValues: [0, 30, 60, 90, 120, 150, 180],
                formatYLabel: v => `${v ?? ''}`,
              },
            ]}
            frame={{ lineColor }}
          >
            {({ points }: { points: Record<string, any> }) => {
              const top = points.maxTwa as { x: number; y?: number }[];
              const bottom = points.minTwa as { x: number; y?: number }[];
              const valid = top.every(p => typeof p.y === 'number');
              if (!valid || top.length < 2) return null;

              const band = Skia.Path.Make();
              band.moveTo(top[0].x, top[0].y!);
              for (let i = 1; i < top.length; i++) {
                band.lineTo(top[i].x, top[i].y!);
              }
              for (let i = bottom.length - 1; i >= 0; i--) {
                band.lineTo(bottom[i].x, bottom[i].y!);
              }
              band.close();

              const maxLine = Skia.Path.Make();
              maxLine.moveTo(top[0].x, top[0].y!);
              for (let i = 1; i < top.length; i++) {
                maxLine.lineTo(top[i].x, top[i].y!);
              }
              const minLine = Skia.Path.Make();
              minLine.moveTo(bottom[0].x, bottom[0].y!);
              for (let i = 1; i < bottom.length; i++) {
                minLine.lineTo(bottom[i].x, bottom[i].y!);
              }

              return (
                <>
                  <Path path={band} color={color} style='fill' opacity={0.25} />
                  <Path
                    path={maxLine}
                    color={color}
                    style='stroke'
                    strokeWidth={2}
                    strokeJoin='round'
                    strokeCap='round'
                  />
                  <Path
                    path={minLine}
                    color={color}
                    style='stroke'
                    strokeWidth={2}
                    strokeJoin='round'
                    strokeCap='round'
                  />
                </>
              );
            }}
          </CartesianChart>
        </View>
      </View>
      <Text className='text-xs text-muted-foreground text-center'>
        TWS (kn)
      </Text>
    </View>
  );
}
