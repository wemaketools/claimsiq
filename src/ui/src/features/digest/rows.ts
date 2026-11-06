/** The digest's pieces: each is picked from rows the full screens build, so no figure is worked out again here. */
import type { ClaimFacts, ReserveMovementFact } from '../../../../contracts/index';
import { t } from '../../lib/i18n';
import type { SelectOption } from '../../components/ui';
import { CLAIM_FILTER_KEYS } from '../claim-scope';
import type { ClaimFilterKey, ClaimFilters, ClaimLookups } from '../claim-scope';
import { QUEUE_SORT, sortRows } from '../actions/rows';
import type { QueueRow } from '../actions/rows';
import type { SupplierRow } from '../suppliers/rows';

/**
 * Rows each table shows, so the printed sheet fits one A4 page whatever the data; the full list is one link away.
 * Exceptions and actions are the readers' first questions; reserve movements and supplier delays are fewer.
 */
export const DIGEST_ROWS = { exceptions: 5, reserve: 3, suppliers: 3, actions: 5 } as const;

export interface Shown<T> {
  readonly rows: readonly T[];
  readonly total: number;
}

export const firstRows = <T>(rows: readonly T[], limit: number): Shown<T> => ({
  rows: rows.slice(0, limit),
  total: rows.length,
});

export interface ReserveRow {
  readonly id: string;
  readonly claim: string;
  readonly movement: ReserveMovementFact;
}

/** Every material reserve movement of the open claims in view, newest first. */
export function reserveRows(facts: readonly ClaimFacts[]): ReserveRow[] {
  return facts
    .filter((fact) => fact.is_open)
    .flatMap((fact) =>
      fact.reserve_movements
        .filter((movement) => movement.material)
        .map((movement) => ({ id: movement.reserve_event_id, claim: fact.claim_id, movement })),
    )
    .sort(
      (a, b) =>
        Date.parse(b.movement.event_at) - Date.parse(a.movement.event_at) ||
        a.id.localeCompare(b.id, 'en', { numeric: true }),
    );
}

/** The suppliers with an open request past the target, or with one whose delay cannot be judged. */
export const delayedSuppliers = (rows: readonly SupplierRow[]): SupplierRow[] =>
  rows.filter((row) => row.insight.breaches > 0 || row.insight.unverified > 0);

/**
 * The tasks not done, in the Action Queue's own order. With `claimsInView` (the claims the filters leave) only the
 * tasks on those claims are kept, so a filtered digest does not list work on other claims.
 */
export function openActions(
  rows: readonly QueueRow[],
  claimsInView: ReadonlySet<string> | null,
): QueueRow[] {
  return sortRows(
    rows.filter(
      (row) =>
        row.task.status !== 'DONE' &&
        (claimsInView === null || (row.claim !== null && claimsInView.has(row.claim))),
    ),
    QUEUE_SORT,
  );
}

const FILTER_LABELS: Readonly<Record<ClaimFilterKey, string>> = {
  policy_id: 'claim-scope.filters.policy',
  broker_id: 'claim-scope.filters.broker',
  product_id: 'claim-scope.filters.product',
  handler_id: 'claim-scope.filters.handler',
};

const OPTION_KEYS: Readonly<Record<ClaimFilterKey, keyof ClaimLookups['options']>> = {
  policy_id: 'policies',
  broker_id: 'brokers',
  product_id: 'products',
  handler_id: 'handlers',
};

/** The filters that narrow the claims, in words ("Broker: Kopano Brokers"), for the page header. */
export function filterSummary(
  filters: ClaimFilters,
  options: ClaimLookups['options'] | undefined,
): string[] {
  return CLAIM_FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    if (value === null) return [];
    const choices: readonly SelectOption[] = options?.[OPTION_KEYS[key]] ?? [];
    const label = choices.find((choice) => choice.value === value)?.label ?? value;
    return [`${t(FILTER_LABELS[key])}: ${label}`];
  });
}
