/** The open-claim stage and age rows both screens draw, taken straight from the engine's summary. */
import type {
  BreakdownRow as ApiBreakdownRow,
  ClaimsSummary,
  MoneyTotals,
} from '../../../../contracts/index';
import type { ClaimCriterion } from './criteria';
import { UNKNOWN, ageBucketLabel, stageLabel } from './criteria';

export interface BreakdownRow extends MoneyTotals {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly criterion: ClaimCriterion;
}

/** Every stage claims can be open in; Reopened only when a claim is in it. Closed claims are not open claims. */
export function stageRows(summary: ClaimsSummary): BreakdownRow[] {
  const rows = summary.by_stage
    .filter((row) => row.stage !== 'Closed' && (row.stage !== 'Reopened' || row.count > 0))
    .map((row) => ({
      id: row.stage,
      label: stageLabel(row.stage),
      count: row.count,
      paid: row.paid,
      reserve: row.reserve,
      incurred: row.incurred,
      criterion: { kind: 'stage', stage: row.stage } as const,
    }));
  const unknown = summary.open_unknown_stage;
  return unknown.count === 0
    ? rows
    : [
        ...rows,
        {
          id: UNKNOWN,
          label: stageLabel(null),
          count: unknown.count,
          paid: unknown.paid,
          reserve: unknown.reserve,
          incurred: unknown.incurred,
          criterion: { kind: 'stage', stage: UNKNOWN },
        },
      ];
}

/** The five age buckets of open claims, then the open claims with no reported date when there are any. */
export function ageRows(summary: ClaimsSummary): BreakdownRow[] {
  const rows = summary.by_age_bucket.map((row) => ({
    id: row.bucket,
    label: ageBucketLabel(row.bucket),
    count: row.count,
    paid: row.paid,
    reserve: row.reserve,
    incurred: row.incurred,
    criterion: { kind: 'age', bucket: row.bucket } as const,
  }));
  const unknown = summary.unknown_age;
  return unknown.count === 0
    ? rows
    : [
        ...rows,
        {
          id: UNKNOWN,
          label: ageBucketLabel(UNKNOWN),
          count: unknown.count,
          paid: unknown.paid,
          reserve: unknown.reserve,
          incurred: unknown.incurred,
          criterion: { kind: 'age', bucket: UNKNOWN },
        },
      ];
}

/** Open claims grouped by product, broker or handler, named. */
export interface GroupRow extends MoneyTotals {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export function groupRows(
  rows: readonly ApiBreakdownRow[],
  nameOf: (id: string | null) => string,
): GroupRow[] {
  return rows.map((row) => ({
    id: row.id ?? 'none',
    label: nameOf(row.id),
    count: row.claims,
    paid: row.paid,
    reserve: row.reserve,
    incurred: row.incurred,
  }));
}
