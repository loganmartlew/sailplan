import { View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { Text } from '~/components/ui';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import type { EditableSailSpan } from '../util/spanEditing';
import { axisFraction, buildTracePath, type TraceSample } from '../util/traceGeometry';

export const TRACE_HEIGHT = 90;

interface SpanTraceProps {
  spans: readonly EditableSailSpan[];
  samples: readonly TraceSample[];
  width: number;
}

/**
 * Boat speed over the leg, on the band's exact time axis. Without it the band
 * is an abstract bar with no referent — nothing tells the sailor where the
 * wind hole was, so nothing tells them where a divider belongs.
 *
 * SVG takes colours as values, not classes, so the theme's own tokens are read
 * from `NAV_THEME` rather than a second palette being invented here.
 */
export function SpanTrace({ spans, samples, width }: SpanTraceProps) {
  const { isDarkColorScheme } = useColorScheme();
  const theme = NAV_THEME[isDarkColorScheme ? 'dark' : 'light'];
  const startTime = spans[0]?.startTime ?? 0;
  const endTime = spans.at(-1)?.endTime ?? startTime + 1;
  const { d, topSpeed } = buildTracePath(samples, {
    startTime,
    endTime,
    width,
    height: TRACE_HEIGHT,
  });
  const x = (time: number) => axisFraction(startTime, endTime, time) * width;

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
              fill={theme.mutedForeground}
              fillOpacity={span.gap === true ? 0.4 : 0.18}
            />
          ),
        )}
        <Path d={d} stroke={theme.text} strokeWidth={1.4} fill='none' />
        {spans.slice(1).map(span => (
          <Line
            key={`divider-${span.startTime}`}
            x1={x(span.startTime)}
            y1={0}
            x2={x(span.startTime)}
            y2={TRACE_HEIGHT}
            stroke={theme.text}
            strokeOpacity={0.5}
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
