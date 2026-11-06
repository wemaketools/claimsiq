/** The stand-in for Premium Collections: the invoices of one policy, joined on the policy identifier only. */
import { useParams, useSearchParams } from 'react-router';

import { endpoints, formatMoney, subtractMoney, sumMoney } from '../../../../contracts/index';
import type { InvoiceRecord } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
} from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { hasTranslation, t } from '../../lib/i18n';
import { CLAIMS_PATH, claimPath, formatMoment } from '../claim-scope';

interface InvoiceRow {
  readonly id: string;
  readonly issued: string;
  readonly due: string | null;
  readonly amount: string;
  readonly allocated: string;
  readonly outstanding: string;
  readonly status: string;
  readonly receipts: readonly string[];
}

function invoiceRow(invoice: InvoiceRecord): InvoiceRow {
  const allocated = sumMoney(invoice.allocations.map((allocation) => allocation.allocated_amount));
  return {
    id: invoice.invoice_id,
    issued: invoice.issue_date,
    due: invoice.due_date,
    amount: invoice.issued_amount,
    allocated,
    outstanding: subtractMoney(invoice.issued_amount, allocated),
    status: invoice.status,
    receipts: [...new Set(invoice.allocations.map((allocation) => allocation.receipt_id))],
  };
}

/** A recorded code such as `PART_PAID` as words, for a status the catalog does not name yet. */
const readable = (code: string): string =>
  code.charAt(0).toUpperCase() + code.slice(1).toLowerCase().replaceAll('_', ' ');

/** The catalog text of a recorded status (`keyOf` names its key), else the code as words. */
function statusText(recorded: string, keyOf: (code: string) => string): string {
  const key = keyOf(recorded);
  return hasTranslation(key) ? t(key) : readable(recorded);
}

const COLUMNS: DataTableColumn<InvoiceRow>[] = [
  {
    id: 'invoice',
    header: t('invoices.column.invoice'),
    cell: (row) => <span className="ciq-ref">{row.id}</span>,
  },
  { id: 'issued', header: t('invoices.column.issued'), cell: (row) => formatMoment(row.issued) },
  {
    id: 'due',
    header: t('invoices.column.due'),
    cell: (row) => (row.due === null ? t('invoices.dueUnknown') : formatMoment(row.due)),
  },
  {
    id: 'amount',
    header: t('invoices.column.amount'),
    numeric: true,
    cell: (row) => formatMoney(row.amount),
  },
  {
    id: 'allocated',
    header: t('invoices.column.allocated'),
    numeric: true,
    cell: (row) => formatMoney(row.allocated),
  },
  {
    id: 'outstanding',
    header: t('invoices.column.outstanding'),
    numeric: true,
    cell: (row) => formatMoney(row.outstanding),
  },
  {
    id: 'status',
    header: t('invoices.column.status'),
    cell: (row) => (
      <Chip tone="neutral-outlined" size="sm">
        {statusText(row.status, (code) => `invoices.status.${code}`)}
      </Chip>
    ),
  },
  {
    id: 'receipts',
    header: t('invoices.column.receipts'),
    cell: (row) =>
      row.receipts.length === 0 ? (
        t('invoices.noReceipts')
      ) : (
        <span className="ciq-mono">{row.receipts.join(', ')}</span>
      ),
  },
];

export default function PolicyInvoicesPage() {
  const policyId = useParams().policyId ?? '';
  const [params] = useSearchParams();
  const fromClaim = params.get('claim');
  const policies = useApiQuery(endpoints.policiesList, {});
  const clients = useApiQuery(endpoints.clientsList, {});
  const products = useApiQuery(endpoints.productsList, {});
  const brokers = useApiQuery(endpoints.brokersList, {});
  const invoices = useApiQuery(endpoints.invoicesList, { query: { policy_id: policyId } });

  const back =
    fromClaim === null
      ? { to: CLAIMS_PATH, label: t('invoices.backToClaims') }
      : { to: claimPath(fromClaim), label: t('invoices.backToClaim', { claim: fromClaim }) };
  const title = t('invoices.title');
  const failure = [policies, invoices].find(
    (query) => query.error !== null && query.data === undefined,
  );
  const policy = policies.data?.items.find((item) => item.policy_id === policyId);

  let body;
  if (failure?.error != null) {
    body = (
      <ErrorState
        error={failure.error}
        onRetry={() => {
          policies.reload();
          invoices.reload();
        }}
        title={t('invoices.loadFailed')}
      />
    );
  } else if (policies.data === undefined || invoices.data === undefined) {
    body = <SkeletonBlock lines={6} />;
  } else if (policy === undefined) {
    body = (
      <EmptyState
        icon="search"
        title={t('invoices.notFound.title')}
        description={t('invoices.notFound.description', { policy: policyId })}
        action={<ButtonLink to={CLAIMS_PATH}>{t('invoices.notFound.action')}</ButtonLink>}
      />
    );
  } else {
    const rows = invoices.data.items.map(invoiceRow);
    const client = clients.data?.items.find((item) => item.client_id === policy.client_id);
    const product = products.data?.items.find((item) => item.product_id === policy.product_id);
    const broker = brokers.data?.items.find((item) => item.broker_id === policy.broker_id);
    body = (
      <>
        <Card title={t('invoices.policy.title')}>
          <DetailList
            items={[
              { key: 'number', label: t('invoices.policy.number'), value: policy.policy_number },
              {
                key: 'client',
                label: t('invoices.policy.client'),
                value: client?.name ?? policy.client_id,
              },
              {
                key: 'product',
                label: t('invoices.policy.product'),
                value: product?.product_name ?? policy.product_id,
              },
              {
                key: 'broker',
                label: t('invoices.policy.broker'),
                value:
                  policy.broker_id === null
                    ? t('invoices.policy.direct')
                    : (broker?.name ?? policy.broker_id),
              },
              {
                key: 'cover',
                label: t('invoices.policy.cover'),
                value: t('invoices.policy.coverRange', {
                  from: formatMoment(policy.inception_at),
                  to: formatMoment(policy.expiry_at),
                }),
              },
              {
                key: 'status',
                label: t('invoices.policy.status'),
                value: statusText(policy.status, (code) => `invoices.policyStatus.${code}`),
              },
            ]}
          />
        </Card>
        <Card title={t('invoices.table.title')} subtitle={t('invoices.table.subtitle')} flush>
          <DataTable
            caption={t('invoices.table.caption')}
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                compact
                icon="receipt"
                title={t('invoices.empty.title')}
                description={t('invoices.empty.description', { policy: policyId })}
              />
            }
          />
          {rows.length > 0 && (
            <p className="ciq-text-muted">
              {t('invoices.table.totals', {
                count: rows.length,
                amount: formatMoney(sumMoney(rows.map((row) => row.amount))),
                allocated: formatMoney(sumMoney(rows.map((row) => row.allocated))),
                outstanding: formatMoney(sumMoney(rows.map((row) => row.outstanding))),
              })}
            </p>
          )}
        </Card>
      </>
    );
  }

  return (
    <div className="ciq-page">
      <PageHeader
        title={title}
        subtitle={
          policy === undefined
            ? undefined
            : t('invoices.subtitle', { number: policy.policy_number, policy: policyId })
        }
        back={back}
      />
      <Banner tone="info" title={t('invoices.standIn.title')}>
        {t('invoices.standIn.body')}
      </Banner>
      {body}
    </div>
  );
}
