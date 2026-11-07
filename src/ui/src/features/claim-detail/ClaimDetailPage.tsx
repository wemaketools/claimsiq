/** Claim Detail: one claim with its policy and client, history, money, flags, suppliers and tasks. */
import { useState } from 'react';
import { useParams } from 'react-router';

import type { ClaimFacts, ClaimRecord } from '../../../../contracts/index';
import { useAppSelector } from '../../app/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
} from '../../components/ui';
import { t } from '../../lib/i18n';
import {
  CLAIMS_PATH,
  SeverityChip,
  SlaChip,
  formatMoment,
  policyInvoicesPath,
  stageLabel,
} from '../claim-scope';
import { CreateTaskDialog, suggestedPriority } from '../claim-tasks';
import { ClaimCard, FlagCard, MoneyCard } from './ClaimCards';
import { PaymentsCard, ReserveCard, SuppliersCard, TimelineCard } from './HistoryCards';
import { TasksCard } from './TasksCard';
import { useClaimNames } from './names';
import { useClaimDetail } from './useClaimDetail';

function Loaded({
  claim,
  facts,
  detail,
}: {
  readonly claim: ClaimRecord;
  readonly facts: ClaimFacts;
  readonly detail: ReturnType<typeof useClaimDetail>;
}) {
  const names = useClaimNames(detail);
  const [creating, setCreating] = useState(false);
  const policy = names.policy(claim.policy_id);
  const client = policy === undefined ? undefined : names.client(policy.client_id);
  const product = policy === undefined ? undefined : names.product(policy.product_id);
  const subtitle =
    client !== undefined && product !== undefined
      ? t('claim-detail.subtitle', { client: client.name, product: product.product_name })
      : undefined;

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('claim-detail.title', { claim: claim.claim_id })}
        subtitle={subtitle}
        back={{ to: CLAIMS_PATH, label: t('claim-detail.back') }}
        meta={
          <>
            <Chip tone={facts.is_open ? 'info' : 'neutral'} size="sm">
              {t(facts.is_open ? 'claim-detail.open' : 'claim-detail.closed')}
            </Chip>
            <Chip tone="neutral-outlined" size="sm">
              {stageLabel(facts.current_stage)}
            </Chip>
            {facts.severity !== null && <SeverityChip severity={facts.severity} />}
            {facts.sla !== null && (
              <span>
                {t('claim-detail.timeline.sla')} <SlaChip status={facts.sla.status} />
              </span>
            )}
          </>
        }
        actions={
          <>
            <ButtonLink to={policyInvoicesPath(claim.policy_id, claim.claim_id)} icon="receipt">
              {t('claim-detail.viewInvoices')}
            </ButtonLink>
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('claim-tasks.create.button')}
            </Button>
          </>
        }
      />
      {detail.namesFailed && (
        <Banner
          tone="warning"
          actions={
            <Button size="sm" onClick={detail.reload}>
              {t('ui.action.retry')}
            </Button>
          }
        >
          {t('claim-detail.namesFailed')}
        </Banner>
      )}
      {facts.sla?.status === 'unknown' && (
        <Banner tone="warning" title={t('claim-detail.slaUnknown.title')}>
          {t('claim-detail.slaUnknown.body')}
        </Banner>
      )}
      <MoneyCard facts={facts} />
      <div className="ciq-grid ciq-grid--2">
        <ClaimCard claim={claim} facts={facts} names={names} />
        <FlagCard facts={facts} />
      </div>
      <div className="ciq-grid ciq-grid--2">
        <TimelineCard claimId={claim.claim_id} events={claim.events} facts={facts} names={names} />
        <TasksCard tasks={detail.tasks} names={names} onCreate={() => setCreating(true)} />
      </div>
      <ReserveCard movements={facts.reserve_movements} />
      <PaymentsCard payments={claim.payments} facts={facts} />
      <SuppliersCard waits={facts.supplier_waits} names={names} />
      {creating && (
        <CreateTaskDialog
          claimId={claim.claim_id}
          defaultPriority={suggestedPriority(facts.severity)}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

export default function ClaimDetailPage() {
  const claimId = useParams().claimId ?? '';
  const asOf = useAppSelector((state) => state.dataContext.asOf);
  const detail = useClaimDetail(claimId);
  const { claim, facts } = detail;

  const loaded = claim.data?.item;
  const error = claim.error ?? facts.error;
  if (error !== null && loaded === undefined) {
    return (
      <div className="ciq-page">
        <PageHeader
          title={t('claim-detail.title', { claim: claimId })}
          back={{ to: CLAIMS_PATH, label: t('claim-detail.back') }}
        />
        {error.kind === 'not_found' ? (
          <EmptyState
            icon="search"
            title={t('claim-detail.notFound.title')}
            description={t('claim-detail.notFound.description', {
              claim: claimId,
              date: formatMoment(asOf),
            })}
            action={<ButtonLink to={CLAIMS_PATH}>{t('claim-detail.notFound.action')}</ButtonLink>}
          />
        ) : (
          <ErrorState error={error} onRetry={detail.reload} title={t('claim-detail.loadFailed')} />
        )}
      </div>
    );
  }
  const fact = facts.data?.items[0];
  if (loaded === undefined || fact === undefined) {
    return (
      <div className="ciq-page">
        <PageHeader
          title={t('claim-detail.title', { claim: claimId })}
          back={{ to: CLAIMS_PATH, label: t('claim-detail.back') }}
        />
        {facts.error !== null ? (
          <ErrorState
            error={facts.error}
            onRetry={detail.reload}
            title={t('claim-detail.loadFailed')}
          />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  return <Loaded claim={loaded} facts={fact} detail={detail} />;
}
