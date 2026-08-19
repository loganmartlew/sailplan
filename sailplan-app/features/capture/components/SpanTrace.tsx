import { View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import type { EditableSailSpan } from '../util/spanEditing';
import type { SteadyWindow } from '../util/legReview';
import {
  axisFraction,
  buildTraceGeometry,
  type TraceSample,
} from '../util/traceGeometry';

/** Room for the speed labels, the time labels, and the max label's ascender. */
const PAD_LEFT = 26;
const PAD_BOTTOM = 15;
const PAD_TOP = 8;
const PLOT_HEIGHT = 96;
export const TRACE_HEIGHT = PLOT_HEIGHT + PAD_TOP + PAD_BOTTOM;

interface SpanTraceProps {
  spans: readonly EditableSailSpan[];
  samples: readonly TraceSample[];
  /** The session's steadiness mask. The lit stretches are the polar points. */
  mask: readonly SteadyWindow[];
  width: number;
}

/**
 * Boat speed over the leg, on the band's exact time axis.
 *
 * Its declared job is divider placement — nothing else on screen says *when* in
 * the leg the boat went slow. The axis and gridlines cost that job nothing (a
 * dip is just as visible with a grid behind it) and let the trace also be read,
 * which is what the shipped version could not do: its only label was
 * `max(observed, 4) × 1.15`, a ceiling nobody had sailed, presented as a speed.
 *
 * The lit columns are the steadiness mask — the seconds that actually become
 * polar points — so dragging a divider across one visibly costs or buys the
 * sailor a point. Attribution is deliberately *not* drawn here: shading every
 * unattributed span washed the whole chart out in exactly the state every leg
 * opens in. That signal belongs to the band below, where it can be read.
 *
 * SVG takes colours as values, not classes, so the theme's own tokens are read
 * from `NAV_THEME` rather than a second palette being invented here.
 */
export function SpanTrace({ spans, samples, mask, width }: SpanTraceProps) {
  const { isDarkColorScheme } = useColorScheme();
  const theme = NAV_THEME[isDarkColorScheme ? 'dark' : 'light'];
  const startTime = spans[0]?.startTime ?? 0;
  const endTime = spans.at(-1)?.endTime ?? startTime + 1;
  const plotWidth = Math.max(1, width - PAD_LEFT);

  if (width <= 0) return <View style={{ height: TRACE_HEIGHT }} />;

  const geometry = buildTraceGeometry({
    samples,
    mask,
    box: { startTime, endTime, width: plotWidth, height: PLOT_HEIGHT },
  });
  const x = (time: number) =>
    PAD_LEFT + axisFraction(startTime, endTime, time) * plotWidth;
  const durationMinutes = (endTime - startTime) / 60_000;
  // Below the line when the maximum *is* the ceiling, or the label sits in the
  // padding above the plot and clips.
  const maxLabelY = geometry.maxSpeedOffset === null
    ? 0
    : PAD_TOP + geometry.maxSpeedOffset + (geometry.maxSpeedOffset < 12 ? 12 : -4);

  return (
    <Svg width={width} height={TRACE_HEIGHT}>
      <G x={PAD_LEFT} y={PAD_TOP}>
        {mask.map(stretch => {
          const left = Math.max(0, x(stretch.startTime) - PAD_LEFT);
          const right = Math.min(plotWidth, x(stretch.endTime) - PAD_LEFT);
          if (right <= 0 || left >= plotWidth) return null;
          return (
            <G key={`steady-${stretch.startTime}`}>
              <Rect
                x={left}
                y={0}
                width={Math.max(1, right - left)}
                height={PLOT_HEIGHT}
                fill={theme.primary}
                fillOpacity={0.13}
              />
              <Rect
                x={left}
                y={PLOT_HEIGHT - 2}
                width={Math.max(1, right - left)}
                height={2}
                fill={theme.primary}
                fillOpacity={0.85}
              />
            </G>
          );
        })}
        {geometry.speedGridlines.map(line => (
          <Line
            key={`speed-${line.value}`}
            x1={0}
            y1={line.offset}
            x2={plotWidth}
            y2={line.offset}
            stroke={theme.border}
            strokeWidth={1}
          />
        ))}
        {geometry.timeGridlines.map(line => (
          <Line
            key={`time-${line.value}`}
            x1={line.offset}
            y1={0}
            x2={line.offset}
            y2={PLOT_HEIGHT}
            stroke={theme.border}
            strokeWidth={1}
          />
        ))}
        <Path
          d={geometry.path}
          stroke={theme.mutedForeground}
          strokeWidth={1.4}
          fill='none'
        />
        <Path
          d={geometry.steadyPath}
          stroke={theme.primary}
          strokeWidth={1.8}
          fill='none'
        />
        {geometry.maxSpeedOffset !== null && (
          <Line
            x1={0}
            y1={geometry.maxSpeedOffset}
            x2={plotWidth}
            y2={geometry.maxSpeedOffset}
            stroke={theme.text}
            strokeOpacity={0.35}
            strokeWidth={1}
            strokeDasharray='3 3'
          />
        )}
        {spans.slice(1).map(span => (
          <Line
            key={`divider-${span.startTime}`}
            x1={x(span.startTime) - PAD_LEFT}
            y1={0}
            x2={x(span.startTime) - PAD_LEFT}
            y2={PLOT_HEIGHT}
            stroke={theme.text}
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
        ))}
      </G>

      {geometry.speedGridlines.map(line => (
        <SvgText
          key={`speed-label-${line.value}`}
          x={PAD_LEFT - 5}
          y={PAD_TOP + line.offset + 3.5}
          textAnchor='end'
          fontSize={9}
          fill={theme.mutedForeground}
        >
          {line.value}
        </SvgText>
      ))}
      {geometry.timeGridlines.map(line => (
        <SvgText
          key={`time-label-${line.value}`}
          x={PAD_LEFT + line.offset}
          y={TRACE_HEIGHT - 3}
          textAnchor='middle'
          fontSize={9}
          fill={theme.mutedForeground}
        >
          {`${line.value}′`}
        </SvgText>
      ))}
      <SvgText
        x={PAD_LEFT}
        y={TRACE_HEIGHT - 3}
        textAnchor='start'
        fontSize={9}
        fill={theme.mutedForeground}
      >
        0′
      </SvgText>
      <SvgText
        x={width}
        y={TRACE_HEIGHT - 3}
        textAnchor='end'
        fontSize={9}
        fill={theme.mutedForeground}
      >
        {`${durationMinutes.toFixed(1)}′`}
      </SvgText>
      {geometry.maxSpeed !== null && (
        // Labelled as a maximum, where the maximum actually is. The old
        // top-right "9 kn" was the axis ceiling on a leg whose fastest moment
        // was 7.8, which read as a speed the boat had done.
        <SvgText
          x={width - 3}
          y={maxLabelY}
          textAnchor='end'
          fontSize={10}
          fill={theme.mutedForeground}
        >
          {`max ${geometry.maxSpeed.toFixed(1)} kn`}
        </SvgText>
      )}
    </Svg>
  );
}
