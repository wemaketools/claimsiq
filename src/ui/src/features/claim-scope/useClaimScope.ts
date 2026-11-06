/**
 * The claims in view: the shared filters (policy, broker, product, handler; remembered in the shell like the as-of
 * date) and the engine's facts and totals for exactly the filtered claims, as the API computes them.
 */
import { DEFAULT_PERIOD, PERIOD_OPTIONS, endpoints } from '../../../../contracts/index';
import type { PeriodOption } from '../../../../contracts/index';
import type { z } from 'zod';
import type { QueryResult } from '../../api/hooks';
import { useScreenFilters } from '../../app/hooks';
import { useClaimFilteredQuery } from './filteredQuery';
import { useClaimLookups } from './lookups';
import type { LookupsResult } from './lookups';

export const CLAIM_SCOPE_SCREEN = 'claim-scope';

export const CLAIM_FILTER_KEYS = ['policy_id', 'broker_id', 'product_id', 'handler_id'] as const;
export type ClaimFilterKey = (typeof CLAIM_FILTER_KEYS)[number];
export type ClaimFilters = Record<ClaimFilterKey, string | null>;

/** The stored shape: the four narrowing filters, and the period the Overview's period cards cover. */
type StoredScope = ClaimFilters & { period: string | null };

const NO_FILTERS: StoredScope = {
  period: null,
  policy_id: null,
  broker_id: null,
  product_id: null,
  handler_id: null,
};

export type ClaimFactsAnswer = z.infer<typeof endpoints.claimsFacts.response>;

export interface ClaimScope {
  readonly filters: ClaimFilters;
  readonly setFilter: (key: ClaimFilterKey, value: string | null) => void;
  readonly clearFilters: () => void;
  /** Whether a filter narrows the claims (the period does not). */
  readonly filtered: boolean;
  readonly period: PeriodOption;
  readonly setPeriod: (period: PeriodOption) => void;
  readonly facts: QueryResult<ClaimFactsAnswer>;
  readonly lookups: LookupsResult;
}

export function useClaimScope(): ClaimScope {
  const [stored, setStored] = useScreenFilters<StoredScope>(CLAIM_SCOPE_SCREEN, NO_FILTERS);
  // A stored value that is not text (the store is browser data) counts as no filter.
  const filters = Object.fromEntries(
    CLAIM_FILTER_KEYS.map((key) => [key, typeof stored[key] === 'string' ? stored[key] : null]),
  ) as ClaimFilters;
  const period = PERIOD_OPTIONS.find((option) => option === stored.period) ?? DEFAULT_PERIOD;
  const facts = useClaimFilteredQuery(endpoints.claimsFacts, filters, { period });
  const lookups = useClaimLookups();
  return {
    filters,
    setFilter: (key, value) => setStored({ [key]: value }),
    clearFilters: () =>
      setStored({ policy_id: null, broker_id: null, product_id: null, handler_id: null }),
    filtered: CLAIM_FILTER_KEYS.some((key) => filters[key] !== null),
    period,
    setPeriod: (next) => setStored({ period: next }),
    facts,
    lookups,
  };
}
