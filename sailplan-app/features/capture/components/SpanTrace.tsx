import { View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { Text } from '~/components/ui';
import { useColorScheme } from '~/lib/useColorScheme';
import type { EditableSailSpan } from '../util/spanEditing';
import { buildTracePath, type TraceSample } from '../util/traceGeometry';

export const TRACE_HEIGHT = 90;

/**
 * Boat speed over the leg, on the band's exact time axis. Without it the band
 * is an abstract bar with no referent — nothing tells the sailor where the
 * wind hole was, so nothing tells them where a divider belongs.
 */
export function SpanTrace({
  spans,
  samples,
  width,
}: {
  spans: readonly EditableSailSpan[];
  samples: readonly TraceSample[];
  width: number;
}) {
  const { isDarkColorScheme } = useColorScheme();
  const startTime = spans[0]?.startTime ?? 0;
  const endTime = spans.at(-1)?.endTime ?? startTime + 1;
  const duration = Math.max(1, endTime - startTime);
  const { d, topSpeed } = buildTracePath(samples, {
    startTime,
    endTime,
    width,
    height: TRACE_HEIGHT,
  });

  const traceColor = isDarkColorScheme ? '#e5e7eb' : '#1f2937';
  const shadeColor = isDarkColorScheme
    ? 'rgba(148,163,184,0.20)'
    : 'rgba(100,116,139,0.16)';
  const gapColor = isDarkColorScheme
    ? 'rgba(15,23,42,0.75)'
    : 'rgba(100,116,139,0.35)';
  const dividerColor = isDarkColorScheme
    ? 'rgba(226,232,240,0.55)'
    : 'rgba(15,23,42,0.45)';
  const x = (time: number) => ((time - startTime) / duration) * width;

  if (width <= 0) return <View style={{ height: TRACE_HEIGHT }} />;

  return (
    <View>
      <Svg width={width} height={TRACE_HEIGHT}>
        {spans.map(span =>
          span.sailId !== null ? null : (
            <Rect
              key={`shade-${span.startTime}`}
              x={x(span.startTime)}
              y={0}
              width={Math.max(1, x(span.endTime) - x(span.startTime))}
              height={TRACE_HEIGHT}
              fill={span.gap === true ? gapColor : shadeColor}
            />
          ),
        )}
        <Path d={d} stroke={traceColor} strokeWidth={1.4} fill='none' />
        {spans.slice(1).map(span => (
          <Line
            key={`divider-${span.startTime}`}
            x1={x(span.startTime)}
            y1={0}
            x2={x(span.startTime)}
            y2={TRACE_HEIGHT}
            stroke={dividerColor}
            strokeWidth={1.5}
          />
        ))}
      </Svg>
      <Text className='absolute right-1 top-1 text-[10px] text-muted-foreground'>
        {`${topSpeed.toFixed(0)} kn`}
      </Text>
    </View>
  );
}
