/**
 * GroupedBarChart: categories on the x axis, one bar per series side by side (for example a median and a 90th
 * percentile per supplier, or the paid amount per month), with an optional dashed reference line (a target or
 * baseline). Recharts, token colours; a `null` value leaves a gap.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { EmptyState } from '../ui/EmptyState';
import { ChartFrame } from './ChartFrame';
import { AXIS_STYLE, GRID_STROKE, TOOLTIP_STYLE, chartColor } from './chartTheme';
import type { TrendPoint, TrendSeries } from './TrendChart';

export interface ChartReference {
  readonly value: number;
  readonly label: string;
}

export interface GroupedBarChartProps {
  readonly series: readonly TrendSeries[];
  /** One entry per category (`x` is the category label). */
  readonly points: readonly TrendPoint[];
  readonly label: string;
  readonly height?: number;
  readonly formatValue?: (value: number) => string;
  /** Header of the category column in the accessible data table (default "Category"). */
  readonly categoryLabel?: string;
  /** A horizontal line across the chart, named in the legend. */
  readonly reference?: ChartReference;
  /** Width of the value axis, for labels longer than a count. */
  readonly axisWidth?: number;
}

export function GroupedBarChart({
  series,
  points,
  label,
  height = 260,
  formatValue = formatCount,
  categoryLabel,
  reference,
  axisWidth = 60,
}: GroupedBarChartProps) {
  if (points.length === 0 || series.length === 0) {
    return <EmptyState compact title={t('charts.empty')} />;
  }
  const data = points.map((point) => ({ x: point.x, ...point.values }));
  const referenceColor = 'var(--ciq-chart-axis)';
  return (
    <ChartFrame
      label={label}
      columns={[categoryLabel ?? t('charts.category'), ...series.map((item) => item.label)]}
      rows={points.map((point) => ({
        key: point.x,
        cells: [
          point.x,
          ...series.map((item) => {
            const value = point.values[item.key];
            return value === null || value === undefined ? '—' : formatValue(value);
          }),
        ],
      }))}
    >
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={data}
            margin={{ top: 8, right: 24, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="x" tick={AXIS_STYLE} stroke={GRID_STROKE} tickLine={false} />
            <YAxis
              tick={AXIS_STYLE}
              stroke={GRID_STROKE}
              tickLine={false}
              tickFormatter={formatValue}
              width={axisWidth}
              domain={[0, (max: number) => Math.max(max, reference?.value ?? 0)]}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) =>
                typeof value === 'number' ? formatValue(value) : String(value ?? '')
              }
            />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={chartColor(item.tone, index)}
                isAnimationActive={false}
              />
            ))}
            {reference !== undefined && (
              <ReferenceLine y={reference.value} stroke={referenceColor} strokeDasharray="4 4" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="ciq-chart-legend ciq-chart-legend--inline">
        {series.map((item, index) => (
          <li key={item.key}>
            <span
              className="ciq-chart-swatch"
              style={{ background: chartColor(item.tone, index) }}
            />
            <span>{item.label}</span>
          </li>
        ))}
        {reference !== undefined && (
          <li>
            <span className="ciq-chart-swatch" style={{ background: referenceColor }} />
            <span>{reference.label}</span>
          </li>
        )}
      </ul>
    </ChartFrame>
  );
}
