/** Nearest-rank percentiles, the one method the supplier scorecard uses. */

/**
 * The nearest-rank percentile: of n values in order, the one at rank ceil(percent / 100 * n), counting from 1. It is
 * always one of the values observed (a wait of 4 business days, never 4.5), the median of two values is the lower
 * one, and the 90th percentile of fewer than ten values is the largest. `null` for no values.
 */
export function nearestRank(values: readonly number[], percent: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.floor((percent * sorted.length + 99) / 100));
  return sorted[rank - 1] ?? null;
}
