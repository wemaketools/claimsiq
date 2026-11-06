/** The rows of the claims list: the engine's facts joined to names, sorted, and as CSV. */
import { compareMoney } from '../../../../contracts/index';
import type { ClaimFacts, Severity, SlaStatus } from '../../../../contracts/index';
import type { DataTableSort } from '../../components/ui';
import { t } from '../../lib/i18n';
import { stageLabel } from '../claim-scope';
import type { ClaimLookups } from '../claim-scope';

export interface ClaimRow {
  readonly id: string;
  readonly client: string;
  readonly product: string;
  readonly stage: ClaimFacts['current_stage'];
  readonly ageDays: number | null;
  readonly handler: string;
  readonly paid: string;
  readonly paidInPeriod: string;
  readonly reserve: string;
  readonly incurred: string;
  /** `null` for a closed claim, which has no stage target. */
  readonly sla: SlaStatus | null;
  readonly severity: Severity | null;
}

export function claimRows(facts: readonly ClaimFacts[], lookups: ClaimLookups): ClaimRow[] {
  return facts.map((fact) => ({
    id: fact.claim_id,
    client: lookups.clientOf(fact),
    product: lookups.productOf(fact),
    stage: fact.current_stage,
    ageDays: fact.age_days,
    handler: lookups.handlerOf(fact),
    paid: fact.paid,
    paidInPeriod: fact.paid_in_period,
    reserve: fact.reserve,
    incurred: fact.incurred,
    sla: fact.sla?.status ?? null,
    severity: fact.severity,
  }));
}

const SLA_ORDER: readonly (SlaStatus | null)[] = [
  'breached',
  'approaching',
  'within',
  'unknown',
  null,
];
const SEVERITY_ORDER: readonly (Severity | null)[] = ['High', 'Medium', 'Low', null];

function compareBy(key: string, a: ClaimRow, b: ClaimRow): number {
  switch (key) {
    case 'client':
      return a.client.localeCompare(b.client);
    case 'product':
      return a.product.localeCompare(b.product);
    case 'stage':
      return stageLabel(a.stage).localeCompare(stageLabel(b.stage));
    case 'age':
      return (a.ageDays ?? -1) - (b.ageDays ?? -1);
    case 'handler':
      return a.handler.localeCompare(b.handler);
    case 'paid':
      return compareMoney(a.paid, b.paid);
    case 'paidInPeriod':
      return compareMoney(a.paidInPeriod, b.paidInPeriod);
    case 'reserve':
      return compareMoney(a.reserve, b.reserve);
    case 'incurred':
      return compareMoney(a.incurred, b.incurred);
    case 'sla':
      return SLA_ORDER.indexOf(a.sla) - SLA_ORDER.indexOf(b.sla);
    case 'severity':
      return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    default:
      return a.id.localeCompare(b.id, 'en', { numeric: true });
  }
}

/** Ties keep claim order, so a sorted list is the same on screen and in the CSV. */
export function sortRows(rows: readonly ClaimRow[], sort: DataTableSort): ClaimRow[] {
  const direction = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      direction * compareBy(sort.key, a, b) || a.id.localeCompare(b.id, 'en', { numeric: true }),
  );
}

export const slaLabel = (status: SlaStatus): string => t(`claim-scope.sla.${status}`);
export const severityLabel = (severity: Severity): string => t(`claim-scope.severity.${severity}`);

/** Header row first. An empty cell is a figure that does not apply (the screen shows a dash). */
export function claimsTable(rows: readonly ClaimRow[], withPaidInPeriod: boolean): string[][] {
  const periodHead = withPaidInPeriod ? [t('claims.csv.paidInPeriod')] : [];
  return [
    [
      t('claims.csv.claim'),
      t('claims.column.client'),
      t('claims.column.product'),
      t('claims.column.stage'),
      t('claims.column.age'),
      t('claims.column.handler'),
      t('claims.csv.paid'),
      ...periodHead,
      t('claims.csv.reserve'),
      t('claims.csv.incurred'),
      t('claims.column.sla'),
      t('claims.column.severity'),
    ],
    ...rows.map((row) => [
      row.id,
      row.client,
      row.product,
      stageLabel(row.stage),
      row.ageDays === null ? '' : String(row.ageDays),
      row.handler,
      row.paid,
      ...(withPaidInPeriod ? [row.paidInPeriod] : []),
      row.reserve,
      row.incurred,
      row.sla === null ? '' : slaLabel(row.sla),
      row.severity === null ? '' : severityLabel(row.severity),
    ]),
  ];
}
