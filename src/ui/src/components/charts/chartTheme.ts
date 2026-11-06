/**
 * Chart colours and styles from the design tokens (charts follow the light/dark theme through CSS variables; no raw
 * colours). Chart geometry needs JS numbers: callers convert decimal strings with `Number()` for plotting ONLY and
 * pass formatted strings (from `lib/format`) for every label and tooltip, so no displayed amount is float-derived.
 */

export type ChartTone = 'accent' | 'info' | 'success' | 'warning' | 'neutral' | 'danger';

const TONE_VARIABLE: Readonly<Record<ChartTone, string>> = {
  accent: 'var(--ciq-chart-1)',
  info: 'var(--ciq-chart-2)',
  success: 'var(--ciq-chart-3)',
  warning: 'var(--ciq-chart-4)',
  neutral: 'var(--ciq-chart-5)',
  danger: 'var(--ciq-chart-6)',
};

export const CHART_SEQUENCE: readonly ChartTone[] = [
  'accent',
  'info',
  'success',
  'warning',
  'neutral',
  'danger',
];

/** The CSS colour of a tone, or of the n-th series when no tone is given. */
export function chartColor(tone: ChartTone | undefined, index: number): string {
  const resolved = tone ?? CHART_SEQUENCE[index % CHART_SEQUENCE.length] ?? 'accent';
  return TONE_VARIABLE[resolved];
}

export const AXIS_STYLE = { fill: 'var(--ciq-chart-axis)', fontSize: 12 } as const;
export const GRID_STROKE = 'var(--ciq-chart-grid)';
export const TOOLTIP_STYLE = {
  background: 'var(--ciq-surface-raised)',
  border: '1px solid var(--ciq-border-subtle)',
  borderRadius: 'var(--ciq-radius-control)',
  boxShadow: 'var(--ciq-shadow-raised)',
  color: 'var(--ciq-text-primary)',
  fontSize: 12,
} as const;
