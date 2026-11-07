/** The rows of the exceptions queue: the engine's facts of the open claims that need review, joined to names. */
import { SEVERITIES, compareMoney } from '../../../../contracts/index';
import type { ClaimFacts, Severity } from '../../../../contracts/index';
import type { DataTableSort } from '../../components/ui';
import { stageLabel, claimReasons, daysLate, severityLabel } from '../claim-scope';
import type { ClaimLookups, ClaimReason, ReasonKey } from '../claim-scope';
import { t } from '../../lib/i18n';

export interface ExceptionRow {
  readonly id: string;
  readonly severity: Severity | null;
  readonly reasons: readonly ClaimReason[];
  readonly owner: string;
  readonly daysLate: number | null;
  readonly stage: ClaimFacts['current_stage'];
  readonly incurred: string;
  /** Open tasks on the claim; `null` while the tasks are not known. */
  readonly openTasks: number | null;
}

/** An open claim the engine flagged, or one at or above the high-value line. */
export const isException = (fact: ClaimFacts): boolean =>
  fact.is_open && (fact.severity !== null || fact.high_value);

export function exceptionRows(
  facts: readonly ClaimFacts[],
  lookups: ClaimLookups,
  openTasksOf: (claimId: string) => number | null,
): ExceptionRow[] {
  return facts.filter(isException).map((fact) => ({
    id: fact.claim_id,
    severity: fact.severity,
    reasons: claimReasons(fact),
    owner: lookups.handlerOf(fact),
    daysLate: daysLate(fact),
    stage: fact.current_stage,
    incurred: fact.incurred,
    openTasks: openTasksOf(fact.claim_id),
  }));
}

export interface ExceptionFilter {
  readonly severity: Severity | null;
  readonly reason: ReasonKey | null;
}

export function filterRows(rows: readonly ExceptionRow[], filter: ExceptionFilter): ExceptionRow[] {
  return rows.filter(
    (row) =>
      (filter.severity === null || row.severity === filter.severity) &&
      (filter.reason === null || row.reasons.some((reason) => reason.key === filter.reason)),
  );
}

const severityRank = (severity: Severity | null): number =>
  severity === null ? SEVERITIES.length : SEVERITIES.indexOf(severity);

const byId = (a: ExceptionRow, b: ExceptionRow): number =>
  a.id.localeCompare(b.id, 'en', { numeric: true });

function compareBy(key: string, a: ExceptionRow, b: ExceptionRow): number {
  switch (key) {
    case 'severity':
      return severityRank(a.severity) - severityRank(b.severity);
    case 'owner':
      return a.owner.localeCompare(b.owner);
    case 'daysLate':
      return (a.daysLate ?? -1) - (b.daysLate ?? -1);
    case 'stage':
      return stageLabel(a.stage).localeCompare(stageLabel(b.stage));
    case 'incurred':
      return compareMoney(a.incurred, b.incurred);
    case 'tasks':
      return (a.openTasks ?? -1) - (b.openTasks ?? -1);
    default:
      return byId(a, b);
  }
}

/** Whatever the column, ties fall back to severity, then more days late first, then claim order. */
export function sortRows(rows: readonly ExceptionRow[], sort: DataTableSort): ExceptionRow[] {
  const direction = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      direction * compareBy(sort.key, a, b) ||
      severityRank(a.severity) - severityRank(b.severity) ||
      (b.daysLate ?? -1) - (a.daysLate ?? -1) ||
      byId(a, b),
  );
}

export const reasonsText = (reasons: readonly ClaimReason[]): string =>
  reasons.map((reason) => `${reason.label} (${reason.key}): ${reason.text}`).join('; ');

/** Header row first. An empty cell is a figure that is not known or does not apply (the screen shows a dash). */
export function exceptionsTable(rows: readonly ExceptionRow[]): string[][] {
  return [
    [
      t('exceptions.csv.claim'),
      t('exceptions.column.severity'),
      t('exceptions.column.reasons'),
      t('exceptions.column.owner'),
      t('exceptions.column.daysLate'),
      t('exceptions.column.stage'),
      t('exceptions.csv.incurred'),
      t('exceptions.csv.openTasks'),
    ],
    ...rows.map((row) => [
      row.id,
      row.severity === null ? '' : severityLabel(row.severity),
      reasonsText(row.reasons),
      row.owner,
      row.daysLate === null ? '' : String(row.daysLate),
      stageLabel(row.stage),
      row.incurred,
      row.openTasks === null ? '' : String(row.openTasks),
    ]),
  ];
}
