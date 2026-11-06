import type { Catalog } from '../../../lib/i18n';

const en = {
  title: 'Policy invoices',
  subtitle: 'Policy {number} ({policy})',
  backToClaim: 'Claim {claim}',
  backToClaims: 'Claims',
  standIn: {
    title: 'A stand-in for Premium Collections',
    body: 'Premium Collections is not connected yet. This read-only view is built from the shared data and joins on the policy identifier only, never on a name. It will be replaced by the real Collections screen.',
  },
  policy: {
    title: 'Policy',
    number: 'Policy',
    client: 'Client',
    product: 'Product',
    broker: 'Broker',
    direct: 'Direct business',
    cover: 'Period of cover',
    coverRange: '{from} to {to}',
    status: 'Status',
  },
  table: {
    title: 'Invoices',
    subtitle: 'Only invoices carrying this policy identifier.',
    caption: 'Invoices of the policy',
    totals_other:
      '{count} invoices for {amount}; {allocated} allocated, {outstanding} outstanding.',
    totals_one: '{count} invoice for {amount}; {allocated} allocated, {outstanding} outstanding.',
  },
  column: {
    invoice: 'Invoice',
    issued: 'Issued',
    due: 'Due',
    amount: 'Amount',
    allocated: 'Allocated',
    outstanding: 'Outstanding',
    status: 'Status',
    receipts: 'Receipts',
  },
  dueUnknown: 'Unknown',
  noReceipts: 'None allocated',
  empty: {
    title: 'No invoice for this policy',
    description:
      'No invoice with the policy identifier {policy} exists in this data set. Nothing was matched by name.',
  },
  notFound: {
    title: 'Policy not found',
    description: 'No policy {policy} exists in this data set.',
    action: 'Back to claims',
  },
  loadFailed: 'The policy invoices could not be loaded',
} satisfies Catalog;

export default en;
