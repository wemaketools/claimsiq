/** The filter bar every claim screen shares: policy, broker, product and handler, with Clear filters. */
import { PERIOD_OPTIONS } from '../../../../contracts/index';
import { ErrorState, FilterBar, Select } from '../../components/ui';
import type { SelectOption } from '../../components/ui';
import { t } from '../../lib/i18n';
import type { ClaimFilterKey, ClaimScope } from './useClaimScope';

const NONE: readonly SelectOption[] = [];

export interface ClaimFilterBarProps {
  readonly scope: ClaimScope;
  /** Adds the period choice, for the screens that show period figures. */
  readonly withPeriod?: boolean;
}

export function ClaimFilterBar({ scope, withPeriod = false }: ClaimFilterBarProps) {
  const { filters, setFilter, lookups } = scope;
  const options = lookups.lookups?.options;
  const field = (
    key: ClaimFilterKey,
    label: string,
    all: string,
    choices: readonly SelectOption[],
  ) => (
    <Select
      label={label}
      placeholder={all}
      value={filters[key] ?? ''}
      options={choices}
      disabled={lookups.lookups === undefined}
      onChange={(value) => setFilter(key, value === '' ? null : value)}
    />
  );
  return (
    <>
      <FilterBar
        label={t('claim-scope.filters.label')}
        onClear={scope.clearFilters}
        canClear={scope.filtered}
      >
        {withPeriod && (
          <Select
            label={t('claim-scope.filters.period')}
            value={scope.period}
            options={PERIOD_OPTIONS.map((option) => ({
              value: option,
              label: t(`claim-scope.period.${option}`),
            }))}
            onChange={(value) => {
              const chosen = PERIOD_OPTIONS.find((option) => option === value);
              if (chosen !== undefined) scope.setPeriod(chosen);
            }}
          />
        )}
        {field(
          'policy_id',
          t('claim-scope.filters.policy'),
          t('claim-scope.filters.allPolicies'),
          options?.policies ?? NONE,
        )}
        {field(
          'broker_id',
          t('claim-scope.filters.broker'),
          t('claim-scope.filters.allBrokers'),
          options?.brokers ?? NONE,
        )}
        {field(
          'product_id',
          t('claim-scope.filters.product'),
          t('claim-scope.filters.allProducts'),
          options?.products ?? NONE,
        )}
        {field(
          'handler_id',
          t('claim-scope.filters.handler'),
          t('claim-scope.filters.allHandlers'),
          options?.handlers ?? NONE,
        )}
      </FilterBar>
      {lookups.error !== null && (
        <ErrorState
          error={lookups.error}
          onRetry={lookups.reload}
          title={t('claim-scope.filters.loadFailed')}
        />
      )}
    </>
  );
}
