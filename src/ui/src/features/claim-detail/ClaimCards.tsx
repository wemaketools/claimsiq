/** The top of Claim Detail: the claim with its source identifiers, paid / reserve / incurred, and why it is flagged. */
import { compareMoney, formatMoney } from '../../../../contracts/index';
import type { ClaimFacts, ClaimRecord } from '../../../../contracts/index';
import { Banner, Card, DetailList, KpiCard, KpiGrid, Reference } from '../../components/ui';
import { t } from '../../lib/i18n';
import {
  SeverityChip,
  claimReasons,
  formatMoment,
  policyInvoicesPath,
  stageLabel,
} from '../claim-scope';
import type { ClaimNames } from './names';

function Named({ name, id }: { readonly name: string | undefined; readonly id: string }) {
  return (
    <>
      {name !== undefined && <>{name} </>}
      <span className="ciq-mono ciq-text-muted">{id}</span>
    </>
  );
}

export function ClaimCard({
  claim,
  facts,
  names,
}: {
  readonly claim: ClaimRecord;
  readonly facts: ClaimFacts;
  readonly names: ClaimNames;
}) {
  const policy = names.policy(claim.policy_id);
  const client = policy === undefined ? undefined : names.client(policy.client_id);
  const product = policy === undefined ? undefined : names.product(policy.product_id);
  const broker = policy?.broker_id == null ? undefined : names.broker(policy.broker_id);
  return (
    <Card title={t('claim-detail.claim.title')}>
      <DetailList
        items={[
          {
            key: 'id',
            label: t('claim-detail.claim.id'),
            value: <Reference value={claim.claim_id} />,
          },
          {
            key: 'status',
            label: t('claim-detail.claim.status'),
            value: t(facts.is_open ? 'claim-detail.open' : 'claim-detail.closed'),
          },
          {
            key: 'stage',
            label: t('claim-detail.claim.stage'),
            value: stageLabel(facts.current_stage),
          },
          {
            key: 'policy',
            label: t('claim-detail.claim.policy'),
            value: (
              <>
                {policy !== undefined && (
                  <Reference
                    value={policy.policy_number}
                    to={policyInvoicesPath(claim.policy_id, claim.claim_id)}
                  />
                )}{' '}
                <span className="ciq-mono ciq-text-muted">{claim.policy_id}</span>
              </>
            ),
          },
          {
            key: 'client',
            label: t('claim-detail.claim.client'),
            value:
              policy === undefined ? null : <Named name={client?.name} id={policy.client_id} />,
          },
          {
            key: 'product',
            label: t('claim-detail.claim.product'),
            value:
              policy === undefined ? null : (
                <Named name={product?.product_name} id={policy.product_id} />
              ),
          },
          {
            key: 'broker',
            label: t('claim-detail.claim.broker'),
            value:
              policy === undefined ? null : policy.broker_id === null ? (
                t('claim-detail.claim.direct')
              ) : (
                <Named name={broker?.name} id={policy.broker_id} />
              ),
          },
          { key: 'loss', label: t('claim-detail.claim.loss'), value: formatMoment(claim.loss_at) },
          {
            key: 'reported',
            label: t('claim-detail.claim.reported'),
            value: formatMoment(claim.reported_at),
          },
          ...(facts.is_open
            ? []
            : [
                {
                  key: 'closedAt',
                  label: t('claim-detail.claim.closedAt'),
                  value: formatMoment(claim.closed_at),
                },
              ]),
          {
            key: 'handler',
            label: t('claim-detail.claim.handler'),
            value: <Named name={names.user(claim.handler_id)} id={claim.handler_id} />,
          },
          {
            key: 'supplier',
            label: t('claim-detail.claim.supplier'),
            value:
              claim.supplier_id === null ? (
                t('claim-detail.none')
              ) : (
                <Named name={names.supplier(claim.supplier_id)} id={claim.supplier_id} />
              ),
          },
        ]}
      />
    </Card>
  );
}

export function MoneyCard({ facts }: { readonly facts: ClaimFacts }) {
  const unpaidApproval =
    facts.is_open &&
    (facts.current_stage === 'Approved' || facts.current_stage === 'Settlement') &&
    compareMoney(facts.paid, '0.00') === 0;
  return (
    <Card title={t('claim-detail.money.title')} subtitle={t('claim-detail.money.subtitle')}>
      <div className="ciq-stack">
        <KpiGrid>
          <KpiCard
            label={t('claim-detail.money.paid')}
            value={formatMoney(facts.paid)}
            hint={t('claim-detail.money.paidHint')}
            icon="wallet"
            tone="success"
          />
          <KpiCard
            label={t('claim-detail.money.reserve')}
            value={formatMoney(facts.reserve)}
            hint={t('claim-detail.money.reserveHint')}
            icon="coins"
            tone="info"
          />
          <KpiCard
            label={t('claim-detail.money.incurred')}
            value={formatMoney(facts.incurred)}
            hint={t('claim-detail.money.incurredHint')}
            icon="scale"
          />
        </KpiGrid>
        <p className="ciq-text-muted">
          {t('claim-detail.money.equation', {
            paid: formatMoney(facts.paid),
            reserve: formatMoney(facts.reserve),
            incurred: formatMoney(facts.incurred),
          })}
        </p>
        {unpaidApproval && (
          <Banner tone="info" title={t('claim-detail.approvedNotPaid.title')}>
            {t('claim-detail.approvedNotPaid.body', { reserve: formatMoney(facts.reserve) })}
          </Banner>
        )}
      </div>
    </Card>
  );
}

export function FlagCard({ facts }: { readonly facts: ClaimFacts }) {
  const reasons = claimReasons(facts);
  return (
    <Card
      title={t('claim-detail.flag.title')}
      subtitle={t('claim-detail.flag.subtitle')}
      actions={facts.severity === null ? undefined : <SeverityChip severity={facts.severity} />}
    >
      {reasons.length === 0 ? (
        <p className="ciq-text-muted">
          {t(facts.is_open ? 'claim-detail.flag.none' : 'claim-detail.flag.noneClosed')}
        </p>
      ) : (
        <ul className="ciq-list-plain">
          {reasons.map((reason) => (
            <li key={reason.key}>
              <strong>{reason.label}</strong>{' '}
              <span className="ciq-mono ciq-text-muted">{reason.key}</span>
              <span className="ciq-cell-sub">{reason.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
