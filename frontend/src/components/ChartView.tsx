import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  type TooltipProps,
} from "recharts";

import { getMarketHours } from "../utils/marketStatus";
import type { SeriesPoint } from "../types";

const MINUTE_MS = 60_000;
const TZ = getMarketHours().timezone;

// Point color relative to yesterday's close.
const COLOR_ABOVE = "#7327F5";
const COLOR_BELOW = "#F52738";
const COLOR_EQUAL = "#EE27F5";

function colorFor(value: number | null, yesterdayClose: number | null): string {
  if (yesterdayClose == null || value === yesterdayClose) return COLOR_EQUAL;
  return value != null && value > yesterdayClose ? COLOR_ABOVE : COLOR_BELOW;
}

const fmtTime = (ms: number): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));

const fmtValue = (n: number | null): string => (n == null ? "—" : Number(n).toFixed(2));

/** Tooltip: value + time for the hovered point. */
function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SeriesPoint;
  if (point.value == null) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__value">{fmtValue(point.value)}</div>
      <div className="chart-tooltip__time">{fmtTime(point.time)}</div>
    </div>
  );
}

interface RenderDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: SeriesPoint;
}

interface ChartViewProps {
  series: SeriesPoint[];
  latestIndex: number;
  yesterdayClose: number | null;
  sessionStart: number;
  sessionEnd: number;
  label: string;
}

/**
 * Main real-time chart.
 *
 * @param series       full-session 1-minute series [{ time, value|null }]
 * @param latestIndex  index of the most recent real data point
 * @param yesterdayClose  reference value
 * @param sessionStart/sessionEnd  X-axis domain (epoch ms)
 * @param label        instrument label, e.g. "Index (DSEX)"
 */
export default function ChartView({
  series,
  latestIndex,
  yesterdayClose,
  sessionStart,
  sessionEnd,
  label,
}: ChartViewProps) {
  // Half-hour X-axis ticks across the whole session.
  const ticks: number[] = [];
  for (let m = sessionStart; m <= sessionEnd; m += 30 * MINUTE_MS) ticks.push(m);

  // Y domain padded around the data and the reference line.
  const values = series.map((p) => p.value).filter((v): v is number => v != null);
  const refs = yesterdayClose == null ? values : [yesterdayClose, ...values];
  const lo = refs.length ? Math.min(...refs) : 0;
  const hi = refs.length ? Math.max(...refs) : 1;
  const pad = (hi - lo) * 0.1 || 1;
  const yDomain: [number, number] = [lo - pad, hi + pad];

  const latest = latestIndex >= 0 ? series[latestIndex] : null;
  const latestColor = latest ? colorFor(latest.value, yesterdayClose) : COLOR_EQUAL;

  // Custom dot: colored per point, with a blinking heartbeat on the latest only.
  const renderDot = (props: RenderDotProps): React.ReactElement => {
    const { cx, cy, index, payload } = props;
    if (cx == null || cy == null || payload?.value == null) {
      return <g key={`dot-${index}`} />;
    }
    const color = colorFor(payload.value, yesterdayClose);
    if (index === latestIndex) {
      return (
        <g key={`dot-${index}`}>
          <circle cx={cx} cy={cy} r={5} fill={color} className="latest-pulse" />
          <circle cx={cx} cy={cy} r={4} fill={color} />
        </g>
      );
    }
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={2} fill={color} />;
  };

  return (
    <div className="chart">
      {latest && (
        <div className="chart__latest" style={{ color: latestColor }}>
          <span className="chart__latest-label">{label}</span>
          <span className="chart__latest-value">{fmtValue(latest.value)}</span>
          <span className="chart__latest-time">{fmtTime(latest.time)}</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={series} margin={{ top: 24, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#1f2530" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={[sessionStart, sessionEnd]}
            ticks={ticks}
            tickFormatter={fmtTime}
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={yDomain}
            tickFormatter={(v: number) => Number(v).toFixed(2)}
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} />

          {yesterdayClose != null && (
            <ReferenceLine
              y={yesterdayClose}
              stroke="#9aa3b2"
              strokeDasharray="6 4"
              label={{
                value: `Yesterday close ${fmtValue(yesterdayClose)}`,
                position: "insideTopLeft",
                fill: "#9aa3b2",
                fontSize: 11,
              }}
            />
          )}

          <Line
            type="linear"
            dataKey="value"
            stroke="#5b6472"
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls={false}
            dot={renderDot}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
