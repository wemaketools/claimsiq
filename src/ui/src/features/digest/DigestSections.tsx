/** The sections of the digest. Each is a card with its own loading, error and empty states. */
import { formatMoney } from '../../../../contracts/index';
import type { ClaimsSummary, SupplierInsights } from '../../../../contracts/index';
import type { ApiError } from '../../api/client';
import {
  Card,
  CardLink,
  Chip,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  Reference,
} from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { EMPTY_VALUE, formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { SeverityChip, claimPath, claimsLink, materialBasis, stageLabel } from '../claim-scope';
import { TaskDue, TaskStatusChip, priorityLabel } from '../claim-tasks';
import type { QueueRow } from '../actions/rows';
import type { ExceptionRow } from '../exceptions/rows';
import { overviewFigures } from '../overview/figures';
import type { SupplierRow } from '../suppliers/rows';
import { Placement } from '../suppliers/WaitPercentiles';
import type { ReserveRow, Shown } from './rows';

/** What a section's table is waiting on: the rows once known, the error that stops them, or neither (loading). */
interface SectionData<T> {
  readonly shown: Shown<T> | undefined;
  readonly error: ApiError | null;
  readonly onRetry: () => void;
}

function Cap({ shown }: { readonly shown: Shown<unknown> }) {
  return shown.total > shown.rows.length ? (
    <p className="ciq-text-muted ciq-digest-note">
      {t('digest.shown', { shown: shown.rows.length, total: shown.total })}
    </p>
  ) : null;
}

export function HeadlineFigures({ summary }: { readonly summary: ClaimsSummary }) {
  return (
    <section className="ciq-digest-section" aria-labelledby="digest-headline">
      <h3 className="ciq-card-title ciq-digest-headline" id="digest-headline">
        {t('digest.headline.title')}
      </h3>
      {overviewFigures(summary).map((group) => (
        <div key={group.heading} className="ciq-stack">
          <h4 className="ciq-digest-group">{group.heading}</h4>
          <KpiGrid>
            {group.figures.map((figure) => (
              <KpiCard
                key={figure.id}
                label={figure.label}
                value={figure.shown}
                hint={figure.hint}
                icon={figure.icon}
                tone={figure.tone}
                to={claimsLink(figure.criterion)}
              />
            ))}
          </KpiGrid>
        </div>
      ))}
    </section>
  );
}

export function ExceptionsSection({
  data,
  summary,
}: {
  readonly data: SectionData<ExceptionRow>;
  /** The sentence the Exceptions screen shows above its table. */
  readonly summary: string | null;
}) {
  const columns: DataTableColumn<ExceptionRow>[] = [
    {
      id: 'claim',
      header: t('digest.exceptions.column.claim'),
      cell: (row) => <Reference value={row.id} to={claimPath(row.id)} />,
    },
    {
      id: 'severity',
      header: t('digest.exceptions.column.severity'),
      cell: (row) =>
        row.severity === null ? EMPTY_VALUE : <SeverityChip severity={row.severity} />,
    },
    {
      id: 'reasons',
      header: t('digest.exceptions.column.reasons'),
      cell: (row) => (
        <span className="ciq-digest-wrap">
          {row.reasons.map((reason) => reason.label).join(', ')}
        </span>
      ),
    },
    { id: 'owner', header: t('digest.exceptions.column.owner'), cell: (row) => row.owner },
    {
      id: 'daysLate',
      header: t('digest.exceptions.column.daysLate'),
      numeric: true,
      cell: (row) => (row.daysLate === null ? EMPTY_VALUE : formatCount(row.daysLate)),
    },
    {
      id: 'stage',
      header: t('digest.exceptions.column.stage'),
      cell: (row) => stageLabel(row.stage),
    },
    {
      id: 'incurred',
      header: t('digest.exceptions.column.incurred'),
      numeric: true,
      cell: (row) => formatMoney(row.incurred),
    },
  ];
  return (
    <Card
      headingLevel={3}
      className="ciq-digest-card"
      title={t('digest.exceptions.title')}
      subtitle={t('digest.exceptions.subtitle')}
      actions={<CardLink to="/exceptions">{t('digest.exceptions.link')}</CardLink>}
    >
      {summary !== null && (
        <p className="ciq-text-muted" role="status">
          {summary}
        </p>
      )}
      <DataTable
        caption={t('digest.exceptions.caption')}
        columns={columns}
        rows={data.shown?.rows}
        rowKey={(row) => row.id}
        loading={data.error === null && data.shown === undefined}
        error={data.error}
        onRetry={data.onRetry}
        empty={
          <EmptyState
            compact
            icon="alertTriangle"
            title={t('digest.exceptions.none')}
            description={t('digest.exceptions.noneDescription')}
          />
        }
      />
      {data.shown !== undefined && <Cap shown={data.shown} />}
    </Card>
  );
}

export function ReserveSection({
  shown,
  claims,
}: {
  readonly shown: Shown<ReserveRow>;
  /** Open claims with a material reserve movement (the engine's count). */
  readonly claims: number;
}) {
  const columns: DataTableColumn<ReserveRow>[] = [
    {
      id: 'claim',
      header: t('digest.reserve.column.claim'),
      cell: (row) => <Reference value={row.claim} to={claimPath(row.claim)} />,
    },
    {
      id: 'date',
      header: t('digest.reserve.column.date'),
      cell: (row) => row.movement.event_at.slice(0, 10),
    },
    {
      id: 'before',
      header: t('digest.reserve.column.before'),
      numeric: true,
      cell: (row) => formatMoney(row.movement.old_amount),
    },
    {
      id: 'after',
      header: t('digest.reserve.column.after'),
      numeric: true,
      cell: (row) => formatMoney(row.movement.new_amount),
    },
    {
      id: 'change',
      header: t('digest.reserve.column.change'),
      numeric: true,
      cell: (row) => (
        <>
          {t(row.movement.kind === 'DECREASE' ? 'digest.reserve.down' : 'digest.reserve.up', {
            amount: formatMoney(row.movement.change_amount),
          })}
          {row.movement.change_percent !== null && (
            <span className="ciq-cell-sub">
              {t('digest.reserve.percent', { percent: row.movement.change_percent })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'basis',
      header: t('digest.reserve.column.basis'),
      cell: (row) => materialBasis(row.movement),
    },
  ];
  return (
    <Card
      headingLevel={3}
      className="ciq-digest-card"
      title={t('digest.reserve.title')}
      subtitle={t('digest.reserve.subtitle')}
      actions={<CardLink to="/claims">{t('digest.reserve.link')}</CardLink>}
    >
      {shown.total > 0 && (
        <p className="ciq-text-muted">{t('digest.reserve.summary', { claims })}</p>
      )}
      <DataTable
        caption={t('digest.reserve.caption')}
        columns={columns}
        rows={shown.rows}
        rowKey={(row) => row.id}
        empty={<EmptyState compact icon="scale" title={t('digest.reserve.none')} />}
      />
      <Cap shown={shown} />
    </Card>
  );
}

export function SuppliersSection({
  data,
  answer,
  summary,
}: {
  readonly data: SectionData<SupplierRow>;
  readonly answer: SupplierInsights | undefined;
  readonly summary: ClaimsSummary;
}) {
  const minimum = answer?.min_sample ?? 0;
  const columns: DataTableColumn<SupplierRow>[] = [
    {
      id: 'supplier',
      header: t('digest.suppliers.column.supplier'),
      cell: (row) => (
        <>
          <span>{row.name}</span>
          {row.serviceType !== null && <span className="ciq-cell-sub">{row.serviceType}</span>}
        </>
      ),
    },
    {
      id: 'open',
      header: t('digest.suppliers.column.open'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.insight.open_requests)}</span>
          {row.insight.unverified > 0 && (
            <span className="ciq-cell-sub">
              {t('digest.suppliers.noRequestTime', { count: row.insight.unverified })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'past',
      header: t('digest.suppliers.column.pastTarget'),
      numeric: true,
      cell: (row) =>
        row.insight.breaches > 0 ? (
          <Chip tone="danger" size="sm">
            {formatCount(row.insight.breaches)}
          </Chip>
        ) : (
          formatCount(0)
        ),
    },
    {
      id: 'longest',
      header: t('digest.suppliers.column.longest'),
      numeric: true,
      cell: (row) =>
        row.insight.wait.longest === null ? EMPTY_VALUE : formatCount(row.insight.wait.longest),
    },
    {
      id: 'median',
      header: t('digest.suppliers.column.median'),
      numeric: true,
      cell: (row) => (
        <>
          <Placement
            value={row.insight.percentiles.median}
            position={row.insight.percentiles.median_vs_target}
          />
          {row.insight.percentiles.median === null && row.insight.percentiles.sample > 0 && (
            <span className="ciq-cell-sub">
              {t('digest.suppliers.notEnough', {
                count: row.insight.percentiles.sample,
                minimum,
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'p90',
      header: t('digest.suppliers.column.p90'),
      numeric: true,
      cell: (row) => (
        <Placement
          value={row.insight.percentiles.p90}
          position={row.insight.percentiles.p90_vs_target}
        />
      ),
    },
  ];
  const baseline = answer?.all_suppliers;
  return (
    <Card
      headingLevel={3}
      className="ciq-digest-card"
      title={t('digest.suppliers.title')}
      subtitle={t('digest.suppliers.subtitle', {
        target: answer?.target_business_days ?? EMPTY_VALUE,
      })}
      actions={<CardLink to="/suppliers">{t('digest.suppliers.link')}</CardLink>}
    >
      <p className="ciq-text-muted">
        {t('digest.suppliers.claims', {
          count: summary.supplier_delayed_claims,
          unverified: summary.supplier_delay_unverified_claims,
        })}
      </p>
      <DataTable
        caption={t('digest.suppliers.caption')}
        columns={columns}
        rows={data.shown?.rows}
        rowKey={(row) => row.id}
        loading={data.error === null && data.shown === undefined}
        error={data.error}
        onRetry={data.onRetry}
        empty={
          <EmptyState
            compact
            icon="truck"
            title={t('digest.suppliers.none')}
            description={t('digest.suppliers.noneDescription')}
          />
        }
      />
      {data.shown !== undefined && <Cap shown={data.shown} />}
      {baseline !== undefined && answer !== undefined && (
        <p className="ciq-text-muted ciq-digest-note">
          {baseline.median === null || baseline.p90 === null
            ? t('digest.suppliers.baselineNotEnough', {
                sample: baseline.sample,
                minimum: answer.min_sample,
              })
            : t('digest.suppliers.baseline', {
                sample: baseline.sample,
                median: formatCount(baseline.median),
                p90: formatCount(baseline.p90),
                target: answer.target_business_days,
              })}
        </p>
      )}
    </Card>
  );
}

export function ActionsSection({
  data,
  filtered,
  overdue,
}: {
  readonly data: SectionData<QueueRow>;
  readonly filtered: boolean;
  readonly overdue: number;
}) {
  const columns: DataTableColumn<QueueRow>[] = [
    {
      id: 'task',
      header: t('digest.actions.column.task'),
      cell: (row) => <span className="ciq-mono">{row.id}</span>,
    },
    {
      id: 'claim',
      header: t('digest.actions.column.claim'),
      cell: (row) =>
        row.claim === null ? (
          row.task.subject_id
        ) : (
          <Reference value={row.claim} to={claimPath(row.claim)} />
        ),
    },
    {
      id: 'owner',
      header: t('digest.actions.column.owner'),
      cell: (row) => row.owner ?? <span className="ciq-text-muted">{t('actions.unassigned')}</span>,
    },
    {
      id: 'due',
      header: t('digest.actions.column.due'),
      cell: (row) => <TaskDue task={row.task} />,
    },
    {
      id: 'priority',
      header: t('digest.actions.column.priority'),
      cell: (row) => priorityLabel(row.task.priority),
    },
    {
      id: 'status',
      header: t('digest.actions.column.status'),
      cell: (row) => <TaskStatusChip status={row.task.status} />,
    },
  ];
  return (
    <Card
      headingLevel={3}
      className="ciq-digest-card"
      title={t('digest.actions.title')}
      subtitle={t('digest.actions.subtitle')}
      actions={<CardLink to="/actions">{t('digest.actions.link')}</CardLink>}
    >
      {data.shown !== undefined && data.shown.total > 0 && (
        <p className="ciq-text-muted" role="status">
          {t('digest.actions.summary', { count: data.shown.total, overdue })}
          {filtered && ` ${t('digest.actions.filtered')}`}
        </p>
      )}
      <DataTable
        caption={t('digest.actions.caption')}
        columns={columns}
        rows={data.shown?.rows}
        rowKey={(row) => row.id}
        loading={data.error === null && data.shown === undefined}
        error={data.error}
        onRetry={data.onRetry}
        empty={
          <EmptyState
            compact
            icon="listChecks"
            title={t('digest.actions.none')}
            description={t('digest.actions.noneDescription')}
          />
        }
      />
      {data.shown !== undefined && <Cap shown={data.shown} />}
    </Card>
  );
}
