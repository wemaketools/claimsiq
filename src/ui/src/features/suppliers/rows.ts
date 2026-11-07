/** The rows of Supplier Insights: the engine's supplier figures joined to the supplier names, and as CSV. */
import type { Supplier, SupplierInsight, WaitPercentiles } from '../../../../contracts/index';
import { t } from '../../lib/i18n';

export interface SupplierRow {
  readonly id: string;
  readonly name: string;
  readonly serviceType: string | null;
  readonly active: boolean;
  readonly insight: SupplierInsight;
}

/** A row of the percentile scorecard: a supplier, or the baseline of every supplier's waits together. */
export interface PercentileRow {
  readonly id: string;
  readonly name: string;
  readonly baseline: boolean;
  readonly percentiles: WaitPercentiles;
}

export const BASELINE_ID = 'ALL-SUPPLIERS';

export const baselineRow = (percentiles: WaitPercentiles): PercentileRow => ({
  id: BASELINE_ID,
  name: t('suppliers.percentiles.baseline'),
  baseline: true,
  percentiles,
});

/** Alphabetical, never ranked by a figure. */
export function supplierRows(
  insights: readonly SupplierInsight[],
  suppliers: readonly Supplier[],
): SupplierRow[] {
  const byId = new Map(suppliers.map((supplier) => [supplier.supplier_id, supplier]));
  return insights
    .map((insight) => {
      const supplier = byId.get(insight.supplier_id);
      return {
        id: insight.supplier_id,
        name: supplier?.name ?? insight.supplier_id,
        serviceType: supplier?.service_type ?? null,
        active: supplier?.active ?? true,
        insight,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const cell = (value: number | null): string => (value === null ? '' : String(value));

/** An average to one decimal as written on screen and in the file. */
export const oneDecimal = (value: number): string => value.toFixed(1);

const positionText = (position: WaitPercentiles['median_vs_target']): string =>
  position === null
    ? ''
    : t(position === 'over' ? 'suppliers.percentiles.over' : 'suppliers.percentiles.within');

const percentileCells = (percentiles: WaitPercentiles): string[] => [
  cell(percentiles.median),
  cell(percentiles.p90),
  positionText(percentiles.median_vs_target),
  positionText(percentiles.p90_vs_target),
];

/**
 * Header row first, then a supplier per row and the all-supplier baseline last. An empty cell is an average or
 * percentile the sample is too small for, or a wait with no request behind it.
 */
export function suppliersTable(
  rows: readonly SupplierRow[],
  baseline: WaitPercentiles,
): string[][] {
  return [
    [
      t('suppliers.csv.supplier'),
      t('suppliers.csv.id'),
      t('suppliers.csv.type'),
      t('suppliers.csv.open'),
      t('suppliers.csv.wait'),
      t('suppliers.csv.waitSample'),
      t('suppliers.csv.median'),
      t('suppliers.csv.p90'),
      t('suppliers.csv.medianVsTarget'),
      t('suppliers.csv.p90VsTarget'),
      t('suppliers.csv.longest'),
      t('suppliers.csv.breaches'),
      t('suppliers.csv.unverified'),
      t('suppliers.csv.cases'),
      t('suppliers.csv.late'),
      t('suppliers.csv.turnaround'),
      t('suppliers.csv.turnaroundSample'),
      t('suppliers.csv.contributing'),
    ],
    ...rows.map(({ insight, ...row }) => [
      row.name,
      row.id,
      row.serviceType ?? '',
      String(insight.open_requests),
      insight.wait.average === null ? '' : oneDecimal(insight.wait.average),
      String(insight.wait.sample),
      ...percentileCells(insight.percentiles),
      cell(insight.wait.longest),
      String(insight.breaches),
      String(insight.unverified),
      String(insight.open_assigned_cases),
      String(insight.late_actions),
      insight.turnaround.average === null ? '' : oneDecimal(insight.turnaround.average),
      String(insight.turnaround.sample),
      String(insight.cases),
    ]),
    [
      t('suppliers.percentiles.baseline'),
      '',
      '',
      '',
      '',
      String(baseline.sample),
      ...percentileCells(baseline),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
  ];
}
