/** The rows of Supplier Insights: the engine's supplier figures joined to the supplier names, and as CSV. */
import type { Supplier, SupplierInsight } from '../../../../contracts/index';
import { t } from '../../lib/i18n';

export interface SupplierRow {
  readonly id: string;
  readonly name: string;
  readonly serviceType: string | null;
  readonly active: boolean;
  readonly insight: SupplierInsight;
}

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

/** Header row first. An empty cell is an average the sample is too small for, or a wait with no request behind it. */
export function suppliersTable(rows: readonly SupplierRow[]): string[][] {
  return [
    [
      t('suppliers.csv.supplier'),
      t('suppliers.csv.id'),
      t('suppliers.csv.type'),
      t('suppliers.csv.open'),
      t('suppliers.csv.wait'),
      t('suppliers.csv.waitSample'),
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
      cell(insight.wait.longest),
      String(insight.breaches),
      String(insight.unverified),
      String(insight.open_assigned_cases),
      String(insight.late_actions),
      insight.turnaround.average === null ? '' : oneDecimal(insight.turnaround.average),
      String(insight.turnaround.sample),
      String(insight.cases),
    ]),
  ];
}
