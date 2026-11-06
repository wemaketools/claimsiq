import { useMemo } from 'react';

import { endpoints } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import { useAppSelector } from '../../app/hooks';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryView,
  SkeletonBlock,
} from '../../components/ui';
import { formatCalendarDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { ClaimFilterBar, useClaimFilteredQuery, useClaimScope } from '../claim-scope';
import { queueRows } from '../actions/rows';
import { exceptionRows, exceptionsSummary, sortRows } from '../exceptions/rows';
import { supplierRows } from '../suppliers/rows';
import {
  ActionsSection,
  ExceptionsSection,
  HeadlineFigures,
  ReserveSection,
  SuppliersSection,
} from './DigestSections';
import {
  DIGEST_ROWS,
  delayedSuppliers,
  filterSummary,
  firstRows,
  openActions,
  reserveRows,
} from './rows';

export default function DigestPage() {
  const scope = useClaimScope();
  const { dataSet, asOf } = useAppSelector((state) => state.dataContext);
  const insights = useClaimFilteredQuery(endpoints.suppliersInsights, scope.filters);
  const suppliers = useApiQuery(endpoints.suppliersList, {});
  const tasks = useApiQuery(endpoints.tasksList, {});
  const users = useApiQuery(endpoints.usersList, {});

  const facts = scope.facts.data?.items;
  const lookups = scope.lookups.lookups;
  const insightAnswer = insights.data;
  const supplierNames = suppliers.data?.items;
  const taskItems = tasks.data?.items;
  const userItems = users.data?.items;

  const exceptions = useMemo(() => {
    if (facts === undefined || lookups === undefined) return undefined;
    return sortRows(
      exceptionRows(facts, lookups, () => null),
      { key: 'severity', dir: 'asc' },
    );
  }, [facts, lookups]);
  const reserve = useMemo(() => (facts === undefined ? undefined : reserveRows(facts)), [facts]);
  const delayed = useMemo(
    () =>
      insightAnswer === undefined || supplierNames === undefined
        ? undefined
        : delayedSuppliers(supplierRows(insightAnswer.items, supplierNames)),
    [insightAnswer, supplierNames],
  );
  const actions = useMemo(() => {
    if (taskItems === undefined || userItems === undefined) return undefined;
    const names = new Map(userItems.map((user) => [user.user_id, user.display_name]));
    return openActions(
      queueRows(taskItems, facts, (id) => names.get(id) ?? id),
      scope.filtered && facts !== undefined ? new Set(facts.map((fact) => fact.claim_id)) : null,
    );
  }, [taskItems, userItems, facts, scope.filtered]);

  const filters = filterSummary(scope.filters, lookups?.options);
  const exceptionsError = scope.lookups.error;
  const suppliersError = insights.error ?? suppliers.error;
  const actionsError = tasks.error ?? users.error;

  return (
    <div className="ciq-page ciq-digest">
      <PageHeader
        title={t('digest.title')}
        subtitle={t('digest.subtitle')}
        actions={
          <Button
            variant="primary"
            icon="printer"
            disabled={scope.facts.data === undefined}
            onClick={() => window.print()}
          >
            {t('digest.print')}
          </Button>
        }
      />
      <div className="ciq-digest-controls">
        <ClaimFilterBar scope={scope} withPeriod />
      </div>
      <article className="ciq-digest-sheet" aria-labelledby="digest-title">
        <header className="ciq-digest-header">
          <h2 className="ciq-digest-title" id="digest-title">
            {t('digest.sheet.title')}
          </h2>
          <dl className="ciq-digest-meta">
            <div>
              <dt>{t('digest.sheet.dataSet')}</dt>
              <dd>{t(`shell.data.set.${dataSet}`)}</dd>
            </div>
            <div>
              <dt>{t('digest.sheet.asOf')}</dt>
              <dd>{formatCalendarDate(asOf)}</dd>
            </div>
            <div>
              <dt>{t('digest.sheet.filters')}</dt>
              <dd>{filters.length === 0 ? t('digest.sheet.noFilters') : filters.join('; ')}</dd>
            </div>
          </dl>
          <p className="ciq-text-muted">{t('digest.sheet.note')}</p>
        </header>
        <QueryView
          query={scope.facts}
          loading={
            <Card data-state="loading">
              <SkeletonBlock lines={4} />
            </Card>
          }
          isEmpty={(data) => data.summary.claims === 0}
          empty={
            <Card data-state="empty">
              <EmptyState
                icon="fileText"
                title={t('digest.empty.title')}
                description={
                  scope.filtered
                    ? t('digest.empty.filteredDescription')
                    : t('digest.empty.description')
                }
              />
            </Card>
          }
        >
          {(data) => (
            <div className="ciq-stack" aria-busy={scope.facts.isFetching}>
              <HeadlineFigures summary={data.summary} />
              <ExceptionsSection
                summary={exceptions === undefined ? null : exceptionsSummary(exceptions)}
                data={{
                  shown:
                    exceptions === undefined
                      ? undefined
                      : firstRows(exceptions, DIGEST_ROWS.exceptions),
                  error: exceptionsError,
                  onRetry: scope.lookups.reload,
                }}
              />
              <ReserveSection
                shown={firstRows(reserve ?? [], DIGEST_ROWS.reserve)}
                claims={data.summary.material_reserve_change_open_claims}
              />
              <SuppliersSection
                summary={data.summary}
                answer={insightAnswer}
                data={{
                  shown:
                    delayed === undefined ? undefined : firstRows(delayed, DIGEST_ROWS.suppliers),
                  error: suppliersError,
                  onRetry: () => {
                    insights.reload();
                    suppliers.reload();
                  },
                }}
              />
              <ActionsSection
                filtered={scope.filtered}
                overdue={actions?.filter((row) => row.task.overdue).length ?? 0}
                data={{
                  shown:
                    actions === undefined ? undefined : firstRows(actions, DIGEST_ROWS.actions),
                  error: actionsError,
                  onRetry: () => {
                    tasks.reload();
                    users.reload();
                  },
                }}
              />
            </div>
          )}
        </QueryView>
      </article>
    </div>
  );
}
