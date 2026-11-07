/** The history of a claim: stage timeline, reserve movements, payments and supplier requests. */
import { chronological, formatMoney } from '../../../../contracts/index';
import type {
  ClaimEvent,
  ClaimFacts,
  ClaimPayment,
  ReserveMovementFact,
  SupplierWaitFact,
} from '../../../../contracts/index';
import { Banner, Card, Chip, DataTable, EmptyState, Timeline } from '../../components/ui';
import type { ChipTone, DataTableColumn, TimelineItem } from '../../components/ui';
import { EMPTY_VALUE } from '../../lib/format';
import { t } from '../../lib/i18n';
import { SlaChip, formatMoment, materialBasis, slaSummary, stageLabel } from '../claim-scope';
import type { ClaimNames } from './names';

const byEventId = (a: ClaimEvent, b: ClaimEvent): number => a.event_id.localeCompare(b.event_id);

/** Dated events oldest first (the engine's order), then the events with no time. */
function orderedEvents(events: readonly ClaimEvent[]): ClaimEvent[] {
  const dated = chronological(
    events.filter((event) => event.event_at !== null),
    (event) => event.event_at ?? '',
    (event) => event.event_id,
  );
  return [...dated, ...events.filter((event) => event.event_at === null).sort(byEventId)];
}

export function TimelineCard({
  claimId,
  events,
  facts,
  names,
}: {
  readonly claimId: string;
  readonly events: readonly ClaimEvent[];
  readonly facts: ClaimFacts;
  readonly names: ClaimNames;
}) {
  const ordered = orderedEvents(events);
  const lastDated = ordered.filter((event) => event.event_at !== null).at(-1);
  const items: TimelineItem[] = ordered.map((event) => {
    const dated = event.event_at !== null;
    const current = event === lastDated;
    return {
      id: event.event_id,
      title: (
        <>
          {event.from_stage === null
            ? t('claim-detail.timeline.entered', { to: stageLabel(event.to_stage) })
            : t('claim-detail.timeline.moved', {
                from: stageLabel(event.from_stage),
                to: stageLabel(event.to_stage),
              })}{' '}
          {current && (
            <Chip tone="accent" size="sm">
              {t('claim-detail.timeline.current')}
            </Chip>
          )}
        </>
      ),
      meta: t('claim-detail.timeline.by', {
        time: formatMoment(event.event_at),
        actor: names.user(event.actor_id),
      }),
      detail: (
        <>
          <span>{t('claim-detail.timeline.reason', { reason: event.reason })}</span>
          <span className="ciq-cell-sub ciq-mono">{event.event_id}</span>
          {!dated && <span className="ciq-text-warning">{t('claim-detail.timeline.undated')}</span>}
        </>
      ),
      tone: current ? 'accent' : dated ? 'neutral' : 'warning',
      icon: dated ? 'clock' : 'alertTriangle',
    };
  });
  const sla = slaSummary(facts);
  const showCheck =
    facts.stage_check === 'DIFFERS' || (lastDated?.to_stage ?? null) !== facts.current_stage;
  return (
    <Card title={t('claim-detail.timeline.title')} subtitle={t('claim-detail.timeline.subtitle')}>
      <div className="ciq-stack">
        {sla !== null && facts.sla !== null && (
          <p>
            <strong>{t('claim-detail.timeline.sla')}</strong> <SlaChip status={facts.sla.status} />{' '}
            <span className="ciq-text-muted">{sla}</span>
          </p>
        )}
        {showCheck ? (
          <Banner tone="warning">
            {t('claim-detail.timeline.check.DIFFERS', {
              recorded: stageLabel(facts.recorded_stage),
              current: stageLabel(facts.current_stage),
            })}
          </Banner>
        ) : (
          <p className="ciq-text-muted">
            {t(`claim-detail.timeline.check.${facts.stage_check}`, {
              stage: stageLabel(facts.recorded_stage),
            })}
          </p>
        )}
        {items.length === 0 ? (
          <EmptyState compact title={t('claim-detail.timeline.empty')} />
        ) : (
          <Timeline items={items} label={t('claim-detail.timeline.label', { claim: claimId })} />
        )}
      </div>
    </Card>
  );
}

function change(movement: ReserveMovementFact): string {
  const amount = formatMoney(movement.change_amount);
  if (movement.kind === 'UNCHANGED') return amount;
  return t(
    movement.kind === 'DECREASE' || movement.kind === 'CLOSING_RELEASE'
      ? 'claim-detail.reserve.decrease'
      : 'claim-detail.reserve.increase',
    {
      amount,
    },
  );
}

export function ReserveCard({ movements }: { readonly movements: readonly ReserveMovementFact[] }) {
  const columns: DataTableColumn<ReserveMovementFact>[] = [
    {
      id: 'date',
      header: t('claim-detail.reserve.column.date'),
      cell: (row) => formatMoment(row.event_at),
    },
    {
      id: 'before',
      header: t('claim-detail.reserve.column.before'),
      numeric: true,
      cell: (row) => formatMoney(row.old_amount),
    },
    {
      id: 'after',
      header: t('claim-detail.reserve.column.after'),
      numeric: true,
      cell: (row) => formatMoney(row.new_amount),
    },
    {
      id: 'change',
      header: t('claim-detail.reserve.column.change'),
      numeric: true,
      cell: (row) =>
        row.kind === 'INITIAL' ? (
          EMPTY_VALUE
        ) : (
          <>
            {change(row)}
            {row.change_percent !== null && (
              <span className="ciq-cell-sub">
                {t('claim-detail.reserve.percent', { percent: row.change_percent })}
              </span>
            )}
          </>
        ),
    },
    {
      id: 'flag',
      header: t('claim-detail.reserve.column.flag'),
      cell: (row) =>
        row.kind === 'INITIAL' ? (
          t('claim-detail.reserve.initial')
        ) : row.kind === 'CLOSING_RELEASE' ? (
          t('claim-detail.reserve.closingRelease')
        ) : row.material ? (
          <>
            <Chip tone="warning" size="sm" icon="flag">
              {t('claim-detail.reserve.material')}
            </Chip>
            <span className="ciq-cell-sub">{materialBasis(row)}</span>
          </>
        ) : (
          t('claim-detail.reserve.notMaterial')
        ),
    },
    {
      id: 'reason',
      header: t('claim-detail.reserve.column.reason'),
      cell: (row) => row.reason,
    },
  ];
  return (
    <Card
      title={t('claim-detail.reserve.title')}
      subtitle={t('claim-detail.reserve.subtitle')}
      flush
    >
      <DataTable
        caption={t('claim-detail.reserve.caption')}
        columns={columns}
        rows={[...movements]}
        rowKey={(row) => row.reserve_event_id}
        empty={<EmptyState compact title={t('claim-detail.reserve.empty')} />}
      />
      {movements.some((movement) => movement.material) && (
        <p className="ciq-text-muted">{t('claim-detail.reserve.note')}</p>
      )}
    </Card>
  );
}

const PAYMENT_TONE = {
  POSTED: 'success',
  PENDING: 'warning',
  VOID: 'neutral',
  REJECTED: 'danger',
} as const satisfies Record<ClaimPayment['status'], ChipTone>;

export function PaymentsCard({
  payments,
  facts,
}: {
  readonly payments: readonly ClaimPayment[];
  readonly facts: ClaimFacts;
}) {
  const byDate = chronological(
    payments,
    (payment) => payment.paid_at,
    (payment) => payment.claim_payment_id,
  );
  const posted = byDate.filter((payment) => payment.status === 'POSTED');
  const notPosted = byDate.filter((payment) => payment.status !== 'POSTED');
  const columns: DataTableColumn<ClaimPayment>[] = [
    {
      id: 'date',
      header: t('claim-detail.payments.column.date'),
      cell: (row) => formatMoment(row.paid_at),
    },
    {
      id: 'reference',
      header: t('claim-detail.payments.column.reference'),
      cell: (row) => <span className="ciq-mono">{row.payment_ref}</span>,
    },
    {
      id: 'amount',
      header: t('claim-detail.payments.column.amount'),
      numeric: true,
      cell: (row) => formatMoney(row.paid_amount),
    },
    {
      id: 'status',
      header: t('claim-detail.payments.column.status'),
      cell: (row) => (
        <Chip tone={PAYMENT_TONE[row.status]} size="sm">
          {t(`claim-detail.payments.status.${row.status}`)}
        </Chip>
      ),
    },
  ];
  return (
    <Card
      title={t('claim-detail.payments.title')}
      subtitle={t('claim-detail.payments.subtitle')}
      flush
    >
      <h3 className="ciq-card-title">{t('claim-detail.payments.posted')}</h3>
      {posted.length === 0 ? (
        <p className="ciq-text-muted">{t('claim-detail.payments.postedEmpty')}</p>
      ) : (
        <DataTable
          caption={t('claim-detail.payments.postedCaption')}
          columns={columns}
          rows={posted}
          rowKey={(row) => row.claim_payment_id}
        />
      )}
      <p className="ciq-text-muted">
        {t('claim-detail.payments.total', { amount: formatMoney(facts.paid) })}
      </p>
      <h3 className="ciq-card-title">{t('claim-detail.payments.notPosted')}</h3>
      {notPosted.length === 0 ? (
        <p className="ciq-text-muted">{t('claim-detail.payments.notPostedEmpty')}</p>
      ) : (
        <>
          <DataTable
            caption={t('claim-detail.payments.notPostedCaption')}
            columns={columns}
            rows={notPosted}
            rowKey={(row) => row.claim_payment_id}
          />
          <p className="ciq-text-muted">{t('claim-detail.payments.notCounted')}</p>
        </>
      )}
    </Card>
  );
}

const WAIT_TONE = {
  delayed: 'danger',
  within: 'success',
  unverified: 'neutral',
  completed: 'info',
} as const satisfies Record<SupplierWaitFact['status'], ChipTone>;

export function SuppliersCard({
  waits,
  names,
}: {
  readonly waits: readonly SupplierWaitFact[];
  readonly names: ClaimNames;
}) {
  const columns: DataTableColumn<SupplierWaitFact>[] = [
    {
      id: 'request',
      header: t('claim-detail.suppliers.column.request'),
      cell: (row) => (
        <>
          {row.request_type}
          <span className="ciq-cell-sub ciq-mono">{row.request_id}</span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('claim-detail.suppliers.column.supplier'),
      cell: (row) => (
        <>
          {names.supplier(row.supplier_id)}
          <span className="ciq-cell-sub ciq-mono">{row.supplier_id}</span>
        </>
      ),
    },
    {
      id: 'requested',
      header: t('claim-detail.suppliers.column.requested'),
      cell: (row) => formatMoment(row.requested_at),
    },
    {
      id: 'completed',
      header: t('claim-detail.suppliers.column.completed'),
      cell: (row) =>
        row.completed_at === null
          ? t('claim-detail.suppliers.pending')
          : formatMoment(row.completed_at),
    },
    {
      id: 'wait',
      header: t('claim-detail.suppliers.column.wait'),
      cell: (row) =>
        row.business_days_waited === null
          ? t('claim-detail.suppliers.waitUnknown', { target: row.target_business_days })
          : t(
              row.business_days_over === null
                ? 'claim-detail.suppliers.wait'
                : 'claim-detail.suppliers.waitOver',
              {
                waited: row.business_days_waited,
                target: row.target_business_days,
                over: row.business_days_over ?? 0,
              },
            ),
    },
    {
      id: 'status',
      header: t('claim-detail.suppliers.column.status'),
      cell: (row) => (
        <Chip tone={WAIT_TONE[row.status]} size="sm">
          {t(`claim-detail.suppliers.status.${row.status}`)}
        </Chip>
      ),
    },
  ];
  return (
    <Card
      title={t('claim-detail.suppliers.title')}
      subtitle={t('claim-detail.suppliers.subtitle')}
      flush
    >
      <DataTable
        caption={t('claim-detail.suppliers.caption')}
        columns={columns}
        rows={[...waits]}
        rowKey={(row) => row.request_id}
        empty={<EmptyState compact title={t('claim-detail.suppliers.empty')} />}
      />
    </Card>
  );
}
