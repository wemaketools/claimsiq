import type { ApiEndpoint } from '../../api/endpoint';
import { useApiQuery } from '../../api/hooks';
import type { ClaimFilters } from './useClaimScope';

/**
 * A read that takes the shared filters (and any further query values): the one way these screens ask, so the request
 * and the "keep the previous answer while a filter changes" choice cannot differ between them. The API client leaves
 * out the null filters.
 */
export function useClaimFilteredQuery<R>(
  endpoint: ApiEndpoint<R>,
  filters: ClaimFilters,
  extra: Readonly<Record<string, string>> = {},
) {
  return useApiQuery(endpoint, { query: { ...filters, ...extra } }, { keepPrevious: true });
}
